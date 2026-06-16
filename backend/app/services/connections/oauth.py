# backend/app/services/connections/oauth.py
"""Google OAuth 2.0 authorization-code flow (with offline access + PKCE).

Scope choice (v1): the narrow per-file scope, so AtlasLM only ever sees files
the user explicitly picks. The full-Drive read scope is a single config change
in ATLAS_GOOGLE_SCOPES once the security review clears; nothing else changes.

No network calls happen at import time. Every outbound call is defensive: it
raises a clean ValueError the route can turn into a 4xx/5xx, never a raw stack.
"""
from __future__ import annotations
import os
import time
import base64
import hashlib
import secrets
import logging
from dataclasses import dataclass
from typing import Optional

import httpx

log = logging.getLogger("connections.oauth")

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
REVOKE_URL = "https://oauth2.googleapis.com/revoke"
USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

# drive.file = per-file access only (the picked files). openid/email for account label.
DEFAULT_SCOPES = "openid email https://www.googleapis.com/auth/drive.file"
SCOPES = os.getenv("ATLAS_GOOGLE_SCOPES", DEFAULT_SCOPES)

CLIENT_ID = os.getenv("ATLAS_GOOGLE_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("ATLAS_GOOGLE_CLIENT_SECRET", "")
REDIRECT_URI = os.getenv("ATLAS_GOOGLE_REDIRECT_URI", "")
HTTP_TIMEOUT = float(os.getenv("ATLAS_CONN_HTTP_TIMEOUT", "15"))


@dataclass
class TokenSet:
    access_token: str
    refresh_token: Optional[str]
    expires_at: float                 # epoch seconds
    scope: str
    account_email: Optional[str] = None


def _pkce_pair() -> tuple[str, str]:
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(48)).rstrip(b"=").decode("ascii")
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode("ascii")).digest()
    ).rstrip(b"=").decode("ascii")
    return verifier, challenge


class GoogleOAuth:
    def __init__(self) -> None:
        self.configured = bool(CLIENT_ID and CLIENT_SECRET and REDIRECT_URI)

    # --- step 1: build the consent URL ------------------------------------
    def build_auth_url(self, state: str) -> tuple[str, str]:
        """Return (auth_url, code_verifier). Store state+verifier server-side."""
        if not self.configured:
            raise ValueError("Google connector is not configured on this server.")
        verifier, challenge = _pkce_pair()
        params = {
            "client_id": CLIENT_ID,
            "redirect_uri": REDIRECT_URI,
            "response_type": "code",
            "scope": SCOPES,
            "access_type": "offline",      # ask for a refresh token
            "prompt": "consent",           # ensure refresh token on re-auth
            "include_granted_scopes": "true",
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        }
        q = "&".join(f"{k}={httpx.QueryParams({k: v})[k]}" for k, v in params.items())
        return f"{AUTH_URL}?{q}", verifier

    # --- step 2: exchange code for tokens ---------------------------------
    def exchange_code(self, code: str, code_verifier: str) -> TokenSet:
        data = {
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "code": code,
            "code_verifier": code_verifier,
            "grant_type": "authorization_code",
            "redirect_uri": REDIRECT_URI,
        }
        tok = self._post_token(data)
        tok.account_email = self._fetch_email(tok.access_token)
        return tok

    # --- refresh ----------------------------------------------------------
    def refresh(self, refresh_token: str) -> TokenSet:
        data = {
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }
        tok = self._post_token(data)
        # Google may omit refresh_token on refresh; caller keeps the old one.
        if not tok.refresh_token:
            tok.refresh_token = refresh_token
        return tok

    # --- revoke (disconnect) ---------------------------------------------
    def revoke(self, token: str) -> bool:
        try:
            with httpx.Client(timeout=HTTP_TIMEOUT) as c:
                r = c.post(REVOKE_URL, data={"token": token},
                           headers={"Content-Type": "application/x-www-form-urlencoded"})
            return r.status_code in (200, 400)  # 400 = already invalid, treat as revoked
        except Exception as e:
            log.warning("revoke call failed: %s", e)
            return False

    # --- internals --------------------------------------------------------
    def _post_token(self, data: dict) -> TokenSet:
        try:
            with httpx.Client(timeout=HTTP_TIMEOUT) as c:
                r = c.post(TOKEN_URL, data=data)
        except Exception as e:
            raise ValueError("Could not reach the sign-in service. Try again.") from e
        if r.status_code != 200:
            log.warning("token endpoint %s: %s", r.status_code, r.text[:200])
            raise ValueError("Sign-in could not be completed. Please reconnect.")
        j = r.json()
        return TokenSet(
            access_token=j["access_token"],
            refresh_token=j.get("refresh_token"),
            expires_at=time.time() + int(j.get("expires_in", 3600)) - 60,
            scope=j.get("scope", SCOPES),
        )

    def _fetch_email(self, access_token: str) -> Optional[str]:
        try:
            with httpx.Client(timeout=HTTP_TIMEOUT) as c:
                r = c.get(USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"})
            if r.status_code == 200:
                return r.json().get("email")
        except Exception as e:
            log.info("userinfo lookup skipped: %s", e)
        return None
