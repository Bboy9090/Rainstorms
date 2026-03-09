"""Shared LLM text-generation helper for Rainstorms.

Routes all LLM chat calls to either OpenAI (gpt-4.1) or Google Gemini
(gemini-2.0-flash) based on the LLM_PROVIDER environment variable.

Environment variables:
  LLM_PROVIDER   – "openai" (default) or "gemini"
  OPENAI_API_KEY – required when LLM_PROVIDER=openai
  GEMINI_API_KEY – required when LLM_PROVIDER=gemini
"""

import os
import logging

logger = logging.getLogger(__name__)

LLM_PROVIDER: str = os.environ.get("LLM_PROVIDER", "openai").lower()
OPENAI_API_KEY: str = os.environ.get("OPENAI_API_KEY", "")
GEMINI_API_KEY: str = os.environ.get("GEMINI_API_KEY", "")

_openai_client = None
_gemini_client = None


def _get_openai():
    global _openai_client
    if _openai_client is None:
        if not OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY is not configured")
        from openai import AsyncOpenAI
        _openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    return _openai_client


def _get_gemini():
    global _gemini_client
    if _gemini_client is None:
        if not GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is not configured")
        from google import genai
        _gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    return _gemini_client


async def llm_chat(system_message: str, user_message: str) -> str:
    """Send a chat prompt to the configured LLM provider and return the response text."""
    if LLM_PROVIDER == "gemini":
        return await _gemini_chat(system_message, user_message)
    return await _openai_chat(system_message, user_message)


async def _openai_chat(system_message: str, user_message: str) -> str:
    client = _get_openai()
    response = await client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message},
        ],
    )
    return response.choices[0].message.content or ""


async def _gemini_chat(system_message: str, user_message: str) -> str:
    client = _get_gemini()
    from google.genai import types
    response = await client.aio.models.generate_content(
        model="gemini-2.0-flash",
        contents=user_message,
        config=types.GenerateContentConfig(system_instruction=system_message),
    )
    return response.text or ""
