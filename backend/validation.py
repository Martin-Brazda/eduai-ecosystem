from pydantic import ValidationError
import json
from models import QuizModel, FlashcardModel
import logging

logger = logging.getLogger(__name__)

def validate_quiz(json_str: str) -> dict:
    """
    Validates a JSON string against the QuizModel.
    Returns the parsed dict if valid, raises ValueError if invalid.
    """
    try:
        data = json.loads(json_str)
    except json.JSONDecodeError as e:
        logger.error(f"Validation failed: Invalid JSON. Error: {str(e)}")
        raise ValueError(f"Invalid JSON format: {str(e)}")

    try:
        quiz = QuizModel(**data)
        return quiz.model_dump()
    except ValidationError as e:
        logger.error(f"Validation failed: Schema mismatch. Error: {str(e)}")
        errors = [f"{err['loc']}: {err['msg']}" for err in e.errors()]
        raise ValueError("JSON Schema Validation failed:\n" + "\n".join(errors))

def validate_flashcards(json_str: str) -> dict:
    """
    Validates a JSON string against the FlashcardModel.
    """
    try:
        data = json.loads(json_str)
    except json.JSONDecodeError as e:
        logger.error(f"Validation failed: Invalid JSON. Error: {str(e)}")
        raise ValueError(f"Invalid JSON format: {str(e)}")

    try:
        flashcards = FlashcardModel(**data)
        return flashcards.model_dump()
    except ValidationError as e:
        logger.error(f"Validation failed: Schema mismatch. Error: {str(e)}")
        errors = [f"{err['loc']}: {err['msg']}" for err in e.errors()]
        raise ValueError("Flashcard Schema Validation failed:\n" + "\n".join(errors))

def validate_notes(text: str) -> str:
    """
    Validates the generated notes to ensure they meet basic quality standards.
    """
    if not text or len(text.strip()) < 50:
        logger.error("Validation failed: Notes too short.")
        raise ValueError("The generated notes are too short. Please provide a comprehensive summary.")
    
    if "##" not in text:
        logger.error("Validation failed: Missing markdown structure.")
        raise ValueError("The notes lack structure. Please use Markdown headings (##) for organization.")
        
    return text.strip()
