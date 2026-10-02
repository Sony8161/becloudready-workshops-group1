import os
import secrets
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from admin_controller import router as admin_router
from auth_controller import router as auth_router
from customer_controller import router as customer_router
from account_controller import router as account_router, transfer_router
from audit_controller import router as audit_router
from db import client
from dependencies import account_repo, audit_repo, auth_service, note_repo, reset_repo, security_repo


def startup() -> None:
    """One-time setup: indexes so the common lookups stay fast as data grows,
    and an admin login so someone can sign in. uvicorn calls it through lifespan below;
    on AWS Lambda, lambda_handler.py calls it once per cold start."""
    account_repo.ensure_indexes()
    audit_repo.ensure_indexes()
    security_repo.ensure_indexes()
    reset_repo.ensure_indexes()
    note_repo.ensure_indexes()
    auth_service.ensure_admin(os.getenv("ADMIN_USERNAME", "admin"), os.getenv("ADMIN_PASSWORD", "admin123"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Runs once when the server starts (before the first request)
    startup()
    yield   # the app runs here; code after yield would run on shutdown


app = FastAPI(title="Banking API", lifespan=lifespan)

# On AWS, CloudFront adds a secret header (X-Origin-Verify) to every request it passes on.
# A request WITHOUT it went around CloudFront, straight to the server, so we refuse it.
# Not set on your PC, so local development works as before.
ORIGIN_SECRET = os.getenv("ORIGIN_SECRET")


@app.middleware("http")
async def only_through_cloudfront(request: Request, call_next):
    if ORIGIN_SECRET and request.url.path != "/api/health":
        sent = request.headers.get("x-origin-verify", "")
        if not secrets.compare_digest(sent, ORIGIN_SECRET):   # compare_digest: no timing hints
            return JSONResponse({"detail": "Forbidden"}, status_code=403)
    return await call_next(request)


@app.get("/api/health", tags=["Health"])
def health():
    """Docker and the deploy script call this to check the API is up AND can reach MongoDB."""
    try:
        client.admin.command("ping")
    except Exception:
        return JSONResponse({"status": "down", "database": "unreachable"}, status_code=503)
    return {"status": "ok", "database": "ok"}


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Extra safety headers on every response."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"   # browser must trust our Content-Type
    response.headers["X-Frame-Options"] = "DENY"             # no one can show the API inside their page
    response.headers["Referrer-Policy"] = "no-referrer"
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"       # never cache balances or tokens
    return response


# Compress big JSON answers (over 1 KB): less data over the network.
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS: a browser blocks a page from one origin (React dev server, port 5173) from reading
# responses from another origin (this API, port 8000) unless the API says it is allowed.
# ALLOWED_ORIGINS in .env (comma separated) adds the real website's address when deployed.
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins],
    allow_methods=["*"],   # GET, POST, PUT, DELETE...
    allow_headers=["*"],   # e.g. Content-Type: application/json, Authorization: Bearer <token>
    expose_headers=["X-Total-Count"],   # lets the browser read our page-count header
)

app.include_router(auth_router)
app.include_router(customer_router)
app.include_router(account_router)
app.include_router(transfer_router)
app.include_router(audit_router)
app.include_router(admin_router)
