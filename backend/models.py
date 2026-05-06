from pydantic import BaseModel, Field, field_validator
from typing import List

class QuestionModel(BaseModel):
    id: str = Field(description="Unique identifier for the question")
    question: str = Field(min_length=5, description="The question text")
    options: List[str] = Field(min_length=4, max_length=4, description="Exactly 4 options")
    correctAnswer: int = Field(ge=0, le=3, description="Index of the correct answer (0-3)")

    @field_validator('options')
    def validate_options_not_empty(cls, v):
        for idx, option in enumerate(v):
            if not option.strip():
                raise ValueError(f"Option {idx} cannot be empty")
        return v

class QuizModel(BaseModel):
    id: str = Field(description="Unique identifier for the quiz")
    quiz_title: str = Field(min_length=3, description="Title of the quiz")
    questions: List[QuestionModel] = Field(min_length=5, description="At least 5 questions")

class FlashcardItem(BaseModel):
    front: str = Field(min_length=1, description="Front side: term, question, or date")
    back: str = Field(min_length=1, description="Back side: definition, answer, or event")

class FlashcardModel(BaseModel):
    id: str = Field(description="Unique identifier for the set")
    title: str = Field(min_length=3, description="Title of the flashcard set")
    cards: List[FlashcardItem] = Field(min_length=5, description="At least 5 cards")
