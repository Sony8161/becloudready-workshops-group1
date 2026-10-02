"""Password hashing (bcrypt) and JWT tokens (HS256)."""
import secrets
import string
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

import config


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except ValueError:
        return False


def temp_password() -> str:
    """Readable one-time password, always has a letter and a number."""
    alphabet = string.ascii_letters + string.digits
    while True:
        pw = "".join(secrets.choice(alphabet) for _ in range(10))
        if any(c.isalpha() for c in pw) and any(c.isdigit() for c in pw):
            return pw


def create_token(user_id: str, role: str, version: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "role": role,
        "ver": version,
        "iat": now,
        "exp": now + timedelta(minutes=config.JWT_MINUTES),
    }
    return jwt.encode(payload, config.JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict:
    return jwt.decode(token, config.JWT_SECRET, algorithms=["HS256"])
