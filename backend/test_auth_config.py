"""Offline signing-configuration checks; no database or AI provider required."""

import os
import unittest
from unittest.mock import patch

from auth_config import load_jwt_secret, validate_jwt_secret


class JwtSigningConfigTests(unittest.TestCase):
    def test_missing_secret_stops_startup(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(ValueError, "JWT_SECRET must be configured"):
                load_jwt_secret()

    def test_weak_or_padded_values_are_rejected(self):
        values = [
            None,
            "",
            " " * 64,
            "short",
            "rainstorms_secret_key_2024_v1",
            "x" * 31,
            " " + "x" * 32,
            "x" * 32 + " ",
        ]
        for value in values:
            with self.subTest(length=None if value is None else len(value)):
                with self.assertRaises(ValueError) as error:
                    validate_jwt_secret(value)
                if value and value.strip():
                    self.assertNotIn(value, str(error.exception))

    def test_valid_configured_key_is_preserved_exactly(self):
        # Synthetic fixture only; never used by an application or provider.
        value = "fixture-signing-key-for-offline-tests-20261024"
        with patch.dict(os.environ, {"JWT_SECRET": value}, clear=True):
            self.assertEqual(load_jwt_secret(), value)

    def test_boundary_length(self):
        self.assertEqual(validate_jwt_secret("x" * 32), "x" * 32)


if __name__ == "__main__":
    unittest.main()
