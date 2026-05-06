import os
import logging
from google import genai
from google.genai.types import Part

logger = logging.getLogger(__name__)

def get_client():
    api_key = os.getenv("GEMINI_KEY")
    if not api_key:
        raise ValueError("NO API KEY SET in environment")
    return genai.Client(api_key=api_key).aio

async def generate_content(contents, response_mime_type="text/plain", model="gemini-2.5-flash"):
    """
    Wrapper around the Gemini API call.
    """
    aclient = get_client()
    logger.info(f"Calling Gemini model '{model}' with mime type: {response_mime_type}")
    
    response = await aclient.models.generate_content(
        model=model,
        contents=contents,
        config=genai.types.GenerateContentConfig(response_mime_type=response_mime_type)
    )
    return response.text
