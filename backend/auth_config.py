"""JWT signing configuration shared by the API and settings model."""

import os
from typing import Optional


def validate_jwt_secret(value: Optional[str]) -> str:
    """Reject absent, padded, or short keys without exposing their contents."""
    if not isinstance(value, str) or value != value.strip() or len(value) < 32:
        raise ValueError(
            "JWT_SECRET must be configured with a unique random value of at least "
            "32 characters, without surrounding whitespace."
        )
    return value


def load_jwt_secret() -> str:
    """Fail startup rather than sign user sessions with a public fallback key."""
    return validate_jwt_secret(os.environ.get("JWT_SECRET"))
