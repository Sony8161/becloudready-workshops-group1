"""AWS Lambda entry point (API Gateway HTTP API -> FastAPI). Handler: lambda_handler.handler"""
from mangum import Mangum

from main import app, init

init()  # indexes + first HR account, once per cold start
handler = Mangum(app, lifespan="off")
