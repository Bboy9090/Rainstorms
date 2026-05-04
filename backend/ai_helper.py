"""Shared LLM text-generation helper for Rainstorms.

Routing strategy:
  LLM_PROVIDER=groq   → Groq (llama-3.3-70b), falls back to Gemini on failure
  LLM_PROVIDER=gemini → Gemini 2.0 Flash only
  LLM_PROVIDER=openai → OpenAI GPT-4.1 only

Environment variables:
  LLM_PROVIDER   – "openai" (default), "gemini", or "groq"
  OPENAI_API_KEY – required when LLM_PROVIDER=openai
  GEMINI_API_KEY – required when LLM_PROVIDER=gemini, or as Groq fallback
  GROQ_API_KEY   – required when LLM_PROVIDER=groq
"""

import os
import logging

logger = logging.getLogger(__name__)

LLM_PROVIDER: str = os.environ.get("LLM_PROVIDER", "openai").lower().strip()
OPENAI_API_KEY: str = os.environ.get("OPENAI_API_KEY", "")
GEMINI_API_KEY: str = os.environ.get("GEMINI_API_KEY", "")
GROQ_API_KEY: str = os.environ.get("GROQ_API_KEY", "")

_openai_client = None
_gemini_client = None
_groq_client = None


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
    # Re-read from env so a newly set key is picked up without a full restart
    _key = os.environ.get("GEMINI_API_KEY", "") or GEMINI_API_KEY
    if _gemini_client is None:
        if not _key:
            raise RuntimeError("GEMINI_API_KEY is not configured")
        from google import genai
        _gemini_client = genai.Client(api_key=_key)
    return _gemini_client


def _get_groq():
    global _groq_client
    if _groq_client is None:
        if not GROQ_API_KEY:
            raise RuntimeError("GROQ_API_KEY is not configured. Get a free key at https://console.groq.com")
        from groq import AsyncGroq
        _groq_client = AsyncGroq(api_key=GROQ_API_KEY)
    return _groq_client


def _llm_status() -> dict:
    """Return LLM provider and whether a key is configured (never exposes values)."""
    if LLM_PROVIDER == "groq":
        key_set = bool(GROQ_API_KEY)
    elif LLM_PROVIDER == "gemini":
        key_set = bool(os.environ.get("GEMINI_API_KEY", "") or GEMINI_API_KEY)
    else:
        key_set = bool(OPENAI_API_KEY)
    return {"provider": LLM_PROVIDER, "configured": key_set}


async def llm_chat(system_message: str, user_message: str) -> str:
    """Send a chat prompt to the configured LLM with a 3-way failsafe chain.
    
    Priority: [Selected Provider] -> Groq -> OpenAI -> Gemini
    This ensures zero-downtime generation for the storymaking pipeline.
    """
    # 1. Determine the chain order
    providers = [LLM_PROVIDER]
    for p in ["groq", "openai", "gemini"]:
        if p not in providers:
            providers.append(p)
            
    last_err = None
    # 2. Iterate through providers until success
    for p in providers:
        try:
            if p == "groq" and GROQ_API_KEY:
                return await _groq_chat(system_message, user_message)
            elif p == "openai" and OPENAI_API_KEY:
                return await _openai_chat(system_message, user_message)
            elif p == "gemini" and (os.environ.get("GEMINI_API_KEY", "") or GEMINI_API_KEY):
                return await _gemini_chat(system_message, user_message)
        except Exception as e:
            logger.warning(f"LLM Provider {p.upper()} failed: {e}. Trying fallback...")
            last_err = e
            continue
            
    # 3. If everything fails, raise the last error
    if last_err:
        raise last_err
    raise RuntimeError("No LLM providers are configured or available.")


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


async def _groq_chat(system_message: str, user_message: str) -> str:
    client = _get_groq()
    response = await client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message},
        ],
    )
    return response.choices[0].message.content or ""
