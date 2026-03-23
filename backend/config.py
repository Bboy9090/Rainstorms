import os
from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).parent

class Settings(BaseSettings):
    """
    Enterprise Configuration for Rainstorms.
    Supports environment variable overrides and .env file loading.
    """
    # API Metadata
    APP_TITLE: str = "Rainstorms API"
    APP_VERSION: str = "1.1.0"
    DEBUG: bool = False

    # Database
    MONGO_URL: str = "mongodb://localhost:27017"
    DB_NAME: str = "rainstorms_db"
    MONGO_TIMEOUT_MS: int = 15000
    MONGO_TLS_SKIP_VERIFY: bool = False

    # Security
    JWT_SECRET: str = "rainstorms_secret_key_2024_v1"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 72
    CORS_ORIGINS: str = "*"

    # AI Providers
    LLM_PROVIDER: str = "openai"  # openai, gemini, groq
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""

    # External APIs
    SAGA_ARCHITECT_BASE_URL: str = ""

    # Storage
    STATIC_DIR: Path = ROOT_DIR / "static"
    ILLUSTRATIONS_DIR: Path = ROOT_DIR / "static" / "illustrations"
    CHARACTERS_DIR: Path = ROOT_DIR / "static" / "characters"

    model_config = SettingsConfigDict(
        env_file=ROOT_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins_list(self) -> List[str]:
        if not self.CORS_ORIGINS:
            return ["*"]
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

# Singleton instance for the application
settings = Settings()
