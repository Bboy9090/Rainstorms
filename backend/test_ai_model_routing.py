"""Unit tests for model selection without sending billable API requests."""

import asyncio
import importlib
import os
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))


class ProviderModelRoutingTests(unittest.TestCase):
    def test_default_models_are_active_replacements(self):
        with patch.dict(os.environ, {"OPENAI_MODEL": "", "GEMINI_MODEL": "", "GROQ_MODEL": ""}):
            import ai_helper
            helper = importlib.reload(ai_helper)
            self.assertEqual(helper.OPENAI_MODEL, "gpt-4.1")
            self.assertEqual(helper.GEMINI_MODEL, "gemini-3.1-flash-lite")
            self.assertEqual(helper.GROQ_MODEL, "openai/gpt-oss-120b")

    def test_provider_model_overrides(self):
        with patch.dict(os.environ, {"OPENAI_MODEL": "custom-openai", "GEMINI_MODEL": "custom-gemini", "GROQ_MODEL": "custom-groq"}):
            import ai_helper
            helper = importlib.reload(ai_helper)
            self.assertEqual((helper.OPENAI_MODEL, helper.GEMINI_MODEL, helper.GROQ_MODEL),
                             ("custom-openai", "custom-gemini", "custom-groq"))

    def test_groq_client_receives_configured_model(self):
        import ai_helper
        helper = importlib.reload(ai_helper)

        class FakeCompletions:
            async def create(self, **kwargs):
                self.arguments = kwargs
                return types.SimpleNamespace(choices=[types.SimpleNamespace(message=types.SimpleNamespace(content="groq-ok"))])

        completions = FakeCompletions()
        client = types.SimpleNamespace(chat=types.SimpleNamespace(completions=completions))
        with patch.object(helper, "_get_groq", return_value=client):
            self.assertEqual(asyncio.run(helper._groq_chat("system", "user")), "groq-ok")
        self.assertEqual(completions.arguments["model"], helper.GROQ_MODEL)

    def test_gemini_client_receives_configured_model(self):
        import ai_helper
        helper = importlib.reload(ai_helper)

        class FakeModels:
            async def generate_content(self, **kwargs):
                self.arguments = kwargs
                return types.SimpleNamespace(text="gemini-ok")

        models = FakeModels()
        client = types.SimpleNamespace(aio=types.SimpleNamespace(models=models))
        fake_genai = types.ModuleType("google.genai")
        fake_genai.types = types.SimpleNamespace(GenerateContentConfig=lambda **kwargs: kwargs)
        with patch.dict(sys.modules, {"google.genai": fake_genai}):
            with patch.object(helper, "_get_gemini", return_value=client):
                self.assertEqual(asyncio.run(helper._gemini_chat("system", "user")), "gemini-ok")
        self.assertEqual(models.arguments["model"], helper.GEMINI_MODEL)


if __name__ == "__main__":
    unittest.main()
