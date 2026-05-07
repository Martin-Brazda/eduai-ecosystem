import logging
import json
import time
import io
from pypdf import PdfReader
from llm_client import generate_content
from validation import validate_quiz, validate_notes, validate_flashcards

logger = logging.getLogger(__name__)

async def extract_text_step(file_part, request_id: str) -> str:
    """Step 1: Extract text and structure from the uploaded file."""
    logger.info(f"[{request_id}] Step 1 started: Extracting text from document...")
    start_time = time.perf_counter()
    
    prompt = "Extract all text, concepts, and relevant information from this document. Preserve structure where possible."
    contents = [{"text": prompt}, file_part]
    extracted_text = await generate_content(contents, response_mime_type="text/plain")
    
    elapsed = time.perf_counter() - start_time
    logger.info(f"[{request_id}] Step 1 completed in {elapsed:.2f}s. Extracted length: {len(extracted_text)} characters.")
    return extracted_text

async def generate_summary_step(extracted_text: str, request_id: str) -> str:
    """Step 2: Generate a comprehensive summary from extracted text."""
    logger.info(f"[{request_id}] Step 2 started: Generating summary...")
    start_time = time.perf_counter()
    
    prompt = "Summarize the following text, highlighting all key facts, definitions, and concepts that would be suitable for a test or quiz."
    contents = [{"text": prompt}, {"text": extracted_text}]
    summary = await generate_content(contents, response_mime_type="text/plain")
    
    elapsed = time.perf_counter() - start_time
    logger.info(f"[{request_id}] Step 2 completed in {elapsed:.2f}s. Summary length: {len(summary)} characters.")
    return summary

async def generate_notes_with_retry(summary: str, system_prompt: str, task_prompt: str, instruction: str, request_id: str) -> str:
    """Step 3 (Notes): Generate notes with validation and retries."""
    logger.info(f"[{request_id}] Step 3 started: Generating Notes with retries...")
    start_time = time.perf_counter()
    max_retries = 3
    
    formatted_task_prompt = task_prompt.format(user_instruction=instruction)
    
    for attempt in range(1, max_retries + 1):
        dynamic_instruction = ""
        if attempt == 2:
            dynamic_instruction = "\n\nCRITICAL: Ensure your output is structured with Markdown headings (##)."
        elif attempt == 3:
            dynamic_instruction = "\n\nCRITICAL: Make sure the notes are comprehensive and strictly follow the formatting rules."
            
        contents = [
            {"text": system_prompt},
            {"text": summary},
            {"text": formatted_task_prompt + dynamic_instruction}
        ]
        
        try:
            logger.debug(f"[{request_id}] Notes generation attempt {attempt}/{max_retries}")
            result_text = await generate_content(contents, response_mime_type="text/plain")
            valid_notes = validate_notes(result_text)
            
            elapsed = time.perf_counter() - start_time
            logger.info(f"[{request_id}] Step 3 completed in {elapsed:.2f}s on attempt {attempt}. Notes length: {len(valid_notes)}.")
            return valid_notes
            
        except ValueError as e:
            logger.warning(f"[{request_id}] Notes generation attempt {attempt} failed: {str(e)}")
            if attempt == max_retries:
                logger.error(f"[{request_id}] Failed to generate valid notes after {max_retries} attempts.")
                raise RuntimeError(f"Failed to generate valid notes after {max_retries} attempts. Last error: {str(e)}")

async def generate_quiz_with_retry(summary: str, system_prompt: str, task_prompt: str, instruction: str, difficulty: str, count: int, request_id: str) -> dict:
    """Step 3 (Quiz): Generate a JSON quiz with robust validation and retries."""
    logger.info(f"[{request_id}] Step 3 started: Generating Quiz (Difficulty: {difficulty}, Count: {count}) with retries...")
    start_time = time.perf_counter()
    max_retries = 3
    
    difficulty_instruction = f"The questions should be of {difficulty.upper()} difficulty. GENERATE EXACTLY {count} QUESTIONS."
    full_instruction = f"{instruction}\n{difficulty_instruction}"
    
    formatted_task_prompt = task_prompt.format(
        user_instruction=full_instruction,
        json_schema="{}" 
    )
    
    # Adding a very explicit count instruction to the system prompt part
    system_prompt_with_count = f"{system_prompt}\n\nCRITICAL: You MUST generate exactly {count} items. No more, no less."
    
    for attempt in range(1, max_retries + 1):
        dynamic_instruction = ""
        if attempt == 2:
            dynamic_instruction = "\n\nCRITICAL: STRICT JSON ONLY. Ensure NO markdown blocks (```json) are in the output. ONLY raw JSON."
        elif attempt == 3:
            dynamic_instruction = f"\n\nCRITICAL: GENERATE EXACTLY {count} QUESTIONS. Ensure options are not empty and correct answers are valid indices."
            
        contents = [
            {"text": system_prompt_with_count},
            {"text": summary},
            {"text": formatted_task_prompt + dynamic_instruction}
        ]
        
        try:
            logger.debug(f"[{request_id}] Quiz generation attempt {attempt}/{max_retries}")
            result_text = await generate_content(contents, response_mime_type="application/json")

            clean_json = result_text.strip().replace("```json", "").replace("```", "")
            valid_quiz_data = validate_quiz(clean_json)
            
            # Slicing or checking count
            questions = valid_quiz_data.get('questions', [])
            if len(questions) != count:
                logger.warning(f"[{request_id}] AI generated {len(questions)} questions instead of {count}. Adjusting...")
                valid_quiz_data['questions'] = questions[:count]
            
            num_questions = len(valid_quiz_data['questions'])
            elapsed = time.perf_counter() - start_time
            logger.info(f"[{request_id}] Step 3 completed in {elapsed:.2f}s on attempt {attempt}. Generated {num_questions} questions.")
            return valid_quiz_data
            
        except ValueError as e:
            logger.warning(f"[{request_id}] Quiz generation attempt {attempt} failed: {str(e)}")
            if attempt == max_retries:
                logger.error(f"[{request_id}] Failed to generate valid quiz after {max_retries} attempts.")
                raise RuntimeError(f"Failed to generate valid quiz after {max_retries} attempts. Last error: {str(e)}")

async def generate_flashcards_with_retry(summary: str, system_prompt: str, task_prompt: str, instruction: str, difficulty: str, count: int, request_id: str) -> dict:
    """Step 3 (Flashcards): Generate a JSON flashcard set with robust validation and retries."""
    logger.info(f"[{request_id}] Step 3 started: Generating Flashcards (Difficulty: {difficulty}, Count: {count}) with retries...")
    start_time = time.perf_counter()
    max_retries = 3
    
    formatted_task_prompt = task_prompt.format(
        INPUT_CONTENT=summary,
        DIFFICULTY=difficulty,
        INSTRUCTION=f"{instruction}. GENERATE EXACTLY {count} FLASHCARDS."
    )
    
    system_prompt_with_count = f"{system_prompt}\n\nCRITICAL: You MUST generate exactly {count} flashcards. No more, no less."
    
    for attempt in range(1, max_retries + 1):
        dynamic_instruction = ""
        if attempt == 2:
            dynamic_instruction = "\n\nCRITICAL: STRICT JSON ONLY. Ensure NO markdown blocks (```json) are in the output. ONLY raw JSON."
        elif attempt == 3:
            dynamic_instruction = f"\n\nCRITICAL: GENERATE EXACTLY {count} FLASHCARDS. Ensure front and back are not empty."
            
        contents = [
            {"text": system_prompt_with_count},
            {"text": summary},
            {"text": formatted_task_prompt + dynamic_instruction}
        ]
        
        try:
            logger.debug(f"[{request_id}] Flashcard generation attempt {attempt}/{max_retries}")
            result_text = await generate_content(contents, response_mime_type="application/json")

            clean_json = result_text.strip().replace("```json", "").replace("```", "")
            valid_flashcards = validate_flashcards(clean_json)
            
            cards = valid_flashcards.get('cards', [])
            if len(cards) != count:
                logger.warning(f"[{request_id}] AI generated {len(cards)} flashcards instead of {count}. Adjusting...")
                valid_flashcards['cards'] = cards[:count]
            
            num_cards = len(valid_flashcards['cards'])
            elapsed = time.perf_counter() - start_time
            logger.info(f"[{request_id}] Step 3 completed in {elapsed:.2f}s on attempt {attempt}. Generated {num_cards} flashcards.")
            return valid_flashcards
            
        except ValueError as e:
            logger.warning(f"[{request_id}] Flashcard generation attempt {attempt} failed: {str(e)}")
            if attempt == max_retries:
                logger.error(f"[{request_id}] Failed to generate valid flashcards after {max_retries} attempts.")
                raise RuntimeError(f"Failed to generate valid flashcards after {max_retries} attempts. Last error: {str(e)}")

def try_local_pdf_extraction(file_bytes: bytes, request_id: str) -> str:
    """Attempt to extract text from PDF bytes using pypdf."""
    try:
        logger.info(f"[{request_id}] Attempting local PDF text extraction...")
        start_time = time.perf_counter()
        reader = PdfReader(io.BytesIO(file_bytes))
        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        
        extracted = text.strip()
        elapsed = time.perf_counter() - start_time
        if len(extracted) > 100: # Threshold for "meaningful" text
            logger.info(f"[{request_id}] Local extraction successful in {elapsed:.2f}s. Length: {len(extracted)} chars.")
            return extracted
        else:
            logger.info(f"[{request_id}] Local extraction yielded insufficient text in {elapsed:.2f}s (likely scanned or empty).")
            return ""
    except Exception as e:
        logger.warning(f"[{request_id}] Local PDF extraction failed: {str(e)}")
        return ""

async def run_pipeline(file_part, mode: str, system_prompt: str, task_prompt: str, instruction: str, difficulty: str, count: int, request_id: str, file_bytes: bytes = None, extracted_text: str = None):
    """
    Main orchestrator for the AI Workflow.
    """
    logger.info(f"[{request_id}] Pipeline started. Mode: {mode}, Difficulty: {difficulty}")
    pipeline_start = time.perf_counter()
    
    try:
        # Step 1: Get text (Local PDF -> AI Fallback -> Direct Text)
        if not extracted_text:
            if file_bytes:
                extracted_text = try_local_pdf_extraction(file_bytes, request_id)
            
            if not extracted_text:
                if not file_part:
                    raise ValueError("No text provided and no file_part for AI extraction.")
                extracted_text = await extract_text_step(file_part, request_id)
        else:
            logger.info(f"[{request_id}] Using pre-extracted text. Skipping AI extraction step.")

        summary = await generate_summary_step(extracted_text, request_id)
        
        if mode == "quiz":
            result = await generate_quiz_with_retry(summary, system_prompt, task_prompt, instruction, difficulty, count, request_id)
            final_data = {"status": "success", "data": result}
        elif mode == "notes":
            result = await generate_notes_with_retry(summary, system_prompt, task_prompt, instruction, request_id)
            final_data = {"status": "success", "data": {"result": result}}
        elif mode == "flashcards":
            result = await generate_flashcards_with_retry(summary, system_prompt, task_prompt, instruction, difficulty, count, request_id)
            final_data = {"status": "success", "data": result}
        else:
            raise ValueError(f"Unknown mode: {mode}")
            
        total_time = time.perf_counter() - pipeline_start
        logger.info(f"[{request_id}] Pipeline completed successfully in {total_time:.2f}s")
        return final_data
            
    except Exception as e:
        total_time = time.perf_counter() - pipeline_start
        logger.error(f"[{request_id}] Pipeline failed after {total_time:.2f}s: {str(e)}")
        return {"status": "error", "message": str(e)}
