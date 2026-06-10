import requests
from jose import JWTError, jwt
from functools import lru_cache
from .config import settings

@lru_cache()
def get_jwks():
    """
    Fetch Supabase project's JWKs for JWT signature verification.
    Supabase exposes keys at /auth/v1/.well-known/jwks.json
    """
    url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
    res = requests.get(url, timeout=10)
    res.raise_for_status()
    return res.json()

async def verify_supabase_jwt(token: str) -> dict:
    """
    Verify a Supabase JWT and return its payload.
    Raises JWTError on failure.

    Supabase uses ES256 (Elliptic Curve P-256) for signing.
    The audience claim is "authenticated".
    """
    # Decode header to get key id
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get('kid')
    alg = unverified_header.get('alg', 'ES256')

    jwks = get_jwks()

    # Find the matching JWK by kid
    key = next(
        (k for k in jwks.get('keys', []) if k.get('kid') == kid),
        None
    )
    if not key:
        raise JWTError(f'JWK for kid={kid} not found in JWKS')

    # Verify and decode token
    # Supabase audience is "authenticated"
    claims = jwt.decode(
        token,
        key,
        algorithms=['ES256'],
        audience='authenticated',
        options={'verify_at_hash': False},
    )
    return claims