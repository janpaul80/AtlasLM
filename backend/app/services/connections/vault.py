# backend/app/services/connections/vault.py
"""Envelope-encrypted token vault.

Refresh tokens are long-lived credentials, so they are NEVER stored in plaintext.
We use Fernet (AES-128-CBC + HMAC) with a key derived from ATLAS_VAULT_KEY. The
stored row keeps only ciphertext plus a key id, so keys can be rotated later
without a schema change (decrypt-with-old, re-encrypt-with-new).

If cryptography is unavailable (dev/offline), we fall back to a clearly-marked
reversible encoding so the rest of the flow still runs. The fallback is refused
when ATLAS_ENV=production so it can never ship a real token unprotected.
"""
from __future__ import annotations
import os
import base64
import hashlib
import logging

log = logging.getLogger("connections.vault")

KEY_ID = os.getenv("ATLAS_VAULT_KEY_ID", "v1")
_RAW = os.getenv("ATLAS_VAULT_KEY", "")
_PROD = os.getenv("ATLAS_ENV", "dev").lower() in ("prod", "production")

try:
    from cryptography.fernet import Fernet, InvalidToken
    _HAVE_CRYPTO = True
except Exception:  # pragma: no cover
    _HAVE_CRYPTO = False


def _fernet() -> "Fernet | None":
    if not (_HAVE_CRYPTO and _RAW):
        return None
    # Derive a stable 32-byte urlsafe key from whatever secret is provided.
    digest = hashlib.sha256(_RAW.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


class TokenVault:
    """Encrypt/decrypt secret material. Stateless; safe to construct per call."""

    def __init__(self) -> None:
        self._f = _fernet()
        if self._f is None and _PROD:
            raise RuntimeError(
                "Token vault has no encryption key. Set ATLAS_VAULT_KEY in production."
            )
        if self._f is None:
            log.warning("Vault running WITHOUT real encryption (dev fallback only).")

    @property
    def key_id(self) -> str:
        return KEY_ID

    def encrypt(self, plaintext: str) -> str:
        if self._f is not None:
            return self._f.encrypt(plaintext.encode("utf-8")).decode("ascii")
        # dev-only reversible marker, never reached in production
        return "DEV:" + base64.urlsafe_b64encode(plaintext.encode("utf-8")).decode("ascii")

    def decrypt(self, ciphertext: str) -> str:
        if ciphertext.startswith("DEV:"):
            return base64.urlsafe_b64decode(ciphertext[4:].encode("ascii")).decode("utf-8")
        if self._f is None:
            raise RuntimeError("No vault key available to decrypt stored token.")
        try:
            return self._f.decrypt(ciphertext.encode("ascii")).decode("utf-8")
        except InvalidToken as e:  # wrong/rotated key
            raise RuntimeError("Stored token could not be decrypted (key mismatch).") from e
