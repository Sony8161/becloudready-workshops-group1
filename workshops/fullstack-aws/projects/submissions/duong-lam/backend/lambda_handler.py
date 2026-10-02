"""Entry point on AWS Lambda (Lambda setting: handler = lambda_handler.handler).

API Gateway turns each HTTP request into an "event" (a JSON dict) and calls Lambda with it.
Mangum translates that event into a normal ASGI request for our FastAPI app, and FastAPI's
response back into the dict API Gateway expects. So the same app runs under uvicorn AND on Lambda.
"""
from mangum import Mangum

from main import app, startup

# Module-level code runs once per "cold start" (when AWS starts a fresh copy of the function),
# not on every request. Later requests reuse this copy, including its MongoDB connection.
startup()

# lifespan="off": we already ran startup() above, so Mangum must not run it again on every request
handler = Mangum(app, lifespan="off")
