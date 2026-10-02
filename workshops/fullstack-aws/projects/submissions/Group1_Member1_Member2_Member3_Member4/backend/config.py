"""Settings read from environment variables (or backend/.env when running locally)."""
import os

from dotenv import load_dotenv

load_dotenv()


def _list(value: str) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


# "mongomock://" runs an in-memory fake MongoDB (no Atlas needed, data resets on restart).
MONGODB_URI = os.getenv("MONGODB_URI", "mongomock://")
MONGODB_DB = os.getenv("MONGODB_DB", "noticeboard")

JWT_SECRET = os.getenv("JWT_SECRET", "dev-only-change-me-please-32-bytes-min")
JWT_MINUTES = int(os.getenv("JWT_MINUTES", "120"))

# First HR login, created on startup if no HR user exists yet.
BOOTSTRAP_HR_EMAIL = os.getenv("BOOTSTRAP_HR_EMAIL", "hr@noticeboard.dev")
BOOTSTRAP_HR_PASSWORD = os.getenv("BOOTSTRAP_HR_PASSWORD", "hrAdmin123")

CORS_ORIGINS = _list(os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"))

# A trainee with plans and no report for this many days shows as "Not reporting".
SILENT_DAYS = int(os.getenv("SILENT_DAYS", "7"))

# Fill an empty database with demo people, plans and reports on startup (handy with mongomock).
SEED_DEMO = os.getenv("SEED_DEMO", "false").lower() in ("1", "true", "yes")
