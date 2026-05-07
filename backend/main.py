import os
import io
import logging
import mimetypes
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google.genai.types import Part
from PIL import Image
from dotenv import load_dotenv
import asyncio
import uuid

from pipeline import run_pipeline
from llm_client import get_client
from database import get_db, engine, Base
from db_models import LibraryItem
from sqlalchemy.orm import Session
from fastapi import Depends

# Initialize Database
Base.metadata.create_all(bind=engine)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s"
)
logger = logging.getLogger(__name__)

load_dotenv()

def load_prompt_file(filename: str) -> str:
    try:
        file_path = os.path.join("prompts", filename)
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        raise RuntimeError(f"Required Prompt file not found: {filename}")    

app = FastAPI(title="AI Workflow Learning App") 

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"422 Validation Error: {exc.errors()}")
    logger.error(f"Request body: {await request.body()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": str(await request.body())},
    )

try: 
    QUIZ_SYSTEM_PROMPT = load_prompt_file("quiz_prompt.md")
    NOTES_SYSTEM_PROMPT = load_prompt_file("notes_prompt.md")
    QUIZ_TASK_PROMPT = load_prompt_file("quiz_task_prompt.md")
    NOTES_TASK_PROMPT = load_prompt_file("notes_task_prompt.md")
    FLASHCARD_SYSTEM_PROMPT = load_prompt_file("flashcard_prompt.md")
    FLASHCARD_TASK_PROMPT = load_prompt_file("flashcard_task_prompt.md")
except RuntimeError as e:
    logger.critical(f"Fatal Error Prompt loading Failed: {e}")

def get_prompts(mode: str):
    if mode == "quiz":
        return QUIZ_SYSTEM_PROMPT, QUIZ_TASK_PROMPT
    elif mode == "notes":
        return NOTES_SYSTEM_PROMPT, NOTES_TASK_PROMPT
    elif mode == "flashcards":
        return FLASHCARD_SYSTEM_PROMPT, FLASHCARD_TASK_PROMPT
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported Generation Mode: {mode}")

@app.post("/process-batch")
async def process_batch(
    files: list[UploadFile] = File(None, description="Optional image or PDF files."),
    text_content: str = Form(None, description="Optional raw text content."),
    mode: str = Form(..., description="Desired output: 'quiz' or 'notes'."),
    prompt_instruction: str = Form(""), 
    difficulty: str = Form("medium"),
    count: int = Form(5, description="Number of items to generate (e.g. questions or flashcards)."),
    db: Session = Depends(get_db)
):
    try:
        get_client()
    except ValueError as e:
        logger.error(f"Initialization error: {str(e)}")
        raise HTTPException(status_code=503, detail="Gemini Client not initialized. Check API Key.")
    
    tasks = []
    
    try: 
        system_prompt, task_prompt = get_prompts(mode)
    except HTTPException as e:
        raise e

    logger.info(f"Received batch request. Files: {len(files) if files else 0}, Text length: {len(text_content) if text_content else 0}. Mode: {mode}, Difficulty: {difficulty}")

    if text_content:
        request_id = str(uuid.uuid4())[:8]
        logger.info(f"[{request_id}] Initializing pipeline for raw text content")
        task = run_pipeline(
            None, # Skipping file_part for raw text
            mode=mode, 
            system_prompt=system_prompt, 
            task_prompt=task_prompt, 
            instruction=prompt_instruction,
            difficulty=difficulty,
            count=count,
            request_id=request_id,
            extracted_text=text_content
        )
        tasks.append(task)

    if files:
        for uploaded_file in files: 
            file_bytes = await uploaded_file.read()
            file_type = uploaded_file.content_type
            filename = uploaded_file.filename or "unknown_file"

            logger.info(f"Processing file: {filename}, Initial MIME type: {file_type}")

            # Handle octet-stream or missing type
            if file_type == "application/octet-stream" or not file_type:
                guessed_type, _ = mimetypes.guess_type(filename)
                if guessed_type:
                    logger.info(f"Guessed type for {filename}: {guessed_type}")
                    file_type = guessed_type
                else:
                    # Last resort for images without extensions
                    logger.info(f"Could not guess type for {filename}, attempting to treat as image")
                    file_type = "image/jpeg" 

            if file_type.startswith("image/"):
                try:
                    file_part = Image.open(io.BytesIO(file_bytes))
                except Exception as e:
                    logger.error(f"Failed to open {filename} as image: {e}")
                    continue
            elif file_type == "application/pdf":
                file_part = Part.from_bytes(data=file_bytes, mime_type="application/pdf")
            elif file_type == "text/plain" or filename.endswith(".txt"):
                file_part = Part.from_bytes(data=file_bytes, mime_type="text/plain")
            else:
                logger.warning(f"Skipping unsupported file type: {file_type} for file: {filename}")
                continue

            request_id = str(uuid.uuid4())[:8]
            logger.info(f"[{request_id}] Initializing pipeline for '{filename}' (type: {file_type})")

            pipeline_kwargs = {
                "file_part": file_part,
                "mode": mode,
                "system_prompt": system_prompt,
                "task_prompt": task_prompt,
                "instruction": prompt_instruction,
                "difficulty": difficulty,
                "count": count,
                "request_id": request_id
            }

            if file_type == "application/pdf":
                pipeline_kwargs["file_bytes"] = file_bytes
            elif file_type == "text/plain" or filename.endswith(".txt"):
                try:
                    pipeline_kwargs["extracted_text"] = file_bytes.decode("utf-8")
                    pipeline_kwargs["file_part"] = None # Skip AI extraction
                except Exception:
                    pass # Fallback to AI if decoding fails

            task = run_pipeline(**pipeline_kwargs)
            tasks.append(task)

    if not tasks:
        raise HTTPException(status_code=400, detail="No valid files were submitted for processing.")

    results = await asyncio.gather(*tasks, return_exceptions=True)

    final_output = []
    has_error = False
    all_failed = True

    for idx, result in enumerate(results):
        if isinstance(result, Exception):
            error_detail = f"Processing failed for file {idx}: {str(result)}"
            logger.error(error_detail)
            final_output.append({"status": "error", "message": error_detail})
            has_error = True
        elif result.get("status") == "error":
            final_output.append(result)
            has_error = True
        else:
            final_output.append(result)
            all_failed = False

    status_code = 200
    if all_failed and len(results) > 0:
        status_code = 500
    elif has_error:
        status_code = 207 # partial failures

    # Persistence logic: Save successful results to the library
    for res in final_output:
        if res.get("status") == "success":
            try:
                data = res.get("data")
                # Attempt to extract a title
                title = "Untitled"
                if mode == "quiz":
                    title = data.get("quiz_title") or "New Quiz"
                elif mode == "flashcards":
                    title = data.get("title") or "New Flashcards"
                elif mode == "notes":
                    title = "AI Notes" # Notes structure is often just a result string
                
                db_item = LibraryItem(
                    id=str(uuid.uuid4()),
                    title=title,
                    type=mode.capitalize(),
                    data=data
                )
                db.add(db_item)
            except Exception as e:
                logger.error(f"Failed to save item to database: {e}")
    
    try:
        db.commit()
    except Exception as e:
        logger.error(f"Database commit failed: {e}")
        db.rollback()

    return JSONResponse(content=final_output, status_code=status_code)

@app.get("/library")
def get_library(db: Session = Depends(get_db)):
    # Return only metadata to keep the list response lightweight
    items = db.query(LibraryItem).order_by(LibraryItem.date.desc()).all()
    return [
        {
            "id": item.id,
            "title": item.title,
            "type": item.type,
            "date": item.date.strftime("%Y-%m-%d")
        } for item in items
    ]

@app.get("/library/{item_id}")
def get_library_item(item_id: str, db: Session = Depends(get_db)):
    logger.info(f"Fetching library item with ID: {item_id}")
    item = db.query(LibraryItem).filter(LibraryItem.id == item_id).first()
    if not item:
        logger.warning(f"Library item not found: {item_id}")
        raise HTTPException(status_code=404, detail="Library item not found")
    return item.to_dict()

@app.get("/health")
def health_check():
    return {"status": "ok"}
