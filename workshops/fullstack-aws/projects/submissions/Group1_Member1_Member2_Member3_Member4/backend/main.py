"""NoticeBoardTracker API. Run locally from backend/:  python -m uvicorn main:app --reload"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

import config
from controllers import (auth_controller, cohort_controller, dashboard_controller, notice_controller,
                         plan_controller, report_controller, user_controller)
from db import ensure_indexes, get_db
from dependencies import get_container
from errors import AppError

_ready = False


def init() -> None:
    """Indexes + first HR account. Safe to call more than once."""
    global _ready
    if _ready:
        return
    ensure_indexes(get_db())
    get_container().auth.bootstrap_hr()
    if config.SEED_DEMO:
        from seed_demo import seed

        seed(get_db())
    _ready = True


@asynccontextmanager
async def lifespan(_: FastAPI):
    init()
    yield


app = FastAPI(
    title="NoticeBoardTracker API",
    description="Onboarding, cohorts, training plans, notices, progress reports and a manager dashboard.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    return response


@app.exception_handler(AppError)
async def app_error(_: Request, exc: AppError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail, **exc.extra})


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    """Turn Pydantic's list of errors into one readable sentence."""
    first = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(p) for p in first.get("loc", [])[1:]) or "request"
    msg = str(first.get("msg", "Invalid input")).replace("Value error, ", "")
    return JSONResponse(status_code=422, content={"detail": f"{field}: {msg}"})


@app.get("/api/health", tags=["Health"])
def health():
    try:
        get_db().command("ping")
        return {"status": "ok"}
    except Exception:
        return JSONResponse(status_code=503, content={"status": "database unreachable"})


for module in (auth_controller, user_controller, cohort_controller, plan_controller, notice_controller,
               report_controller, dashboard_controller):
    app.include_router(module.router)
