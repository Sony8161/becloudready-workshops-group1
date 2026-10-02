"""Passwords and tokens. The only file that knows HOW we hash passwords and sign tokens."""
import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from dotenv import load_dotenv

from models import User

load_dotenv()   # JWT_SECRET lives in backend/.env, next to MONGODB_URI (never commit it)

SECRET_KEY = os.getenv("JWT_SECRET", "dev-only-secret-change-me-in-backend-env")
ALGORITHM = "HS256"                                   # HMAC + SHA-256: one secret signs and checks
TOKEN_MINUTES = int(os.getenv("JWT_MINUTES", "60"))   # how long a login lasts
MAX_FAILED_LOGINS = int(os.getenv("MAX_FAILED_LOGINS", "5"))   # wrong passwords in a row before a lockout
LOCK_MINUTES = int(os.getenv("LOCK_MINUTES", "15"))             # how long the lockout lasts
RESET_MINUTES = int(os.getenv("RESET_MINUTES", "15"))           # how long a "forgot password" link works

if "JWT_SECRET" not in os.environ:
    print("WARNING: JWT_SECRET is not set in backend/.env, using an insecure development secret")


# ---------- Passwords ----------
def hash_password(password: str) -> str:
    """"admin123" -> "$2b$12$Kix..."  One-way: the hash can't be turned back into the password.
    gensalt() adds random salt, so two people with the same password get different hashes."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    """Hashes the typed password with the SAME salt (stored inside the hash) and compares."""
    return bcrypt.checkpw(password.encode(), password_hash.encode())


# ---------- JWT (JSON Web Token) ----------
# A JWT is three base64 parts: header.payload.signature
# Anyone can READ the payload (paste one into jwt.io), but nobody can CHANGE it without the
# secret, because the signature would no longer match. So: never put secrets in the payload.
def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),             # "subject": who this token is about (must be a string)
        "username": user.username,
        "role": user.role.value,
        "customer_id": user.customer_id,
        "ver": getattr(user, "token_version", 0),   # must match the login's token_version (sign out everywhere)
        "iat": now,                      # issued at
        "exp": now + timedelta(minutes=TOKEN_MINUTES),   # expires: jwt.decode rejects it after this
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Checks the signature AND the expiry, then returns the payload.
    Raises jwt.ExpiredSignatureError (too old) or jwt.InvalidTokenError (fake / changed / garbage)."""
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
