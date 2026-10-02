# The FastAPI backend as ONE Lambda function. API Gateway sends it every /api/* request;
# Mangum (backend/lambda_handler.py) hands each one to FastAPI. No server to manage:
# AWS starts copies when requests come in and you pay per request.

locals {
  lambda_zip  = "${path.module}/build/lambda.zip" # made by build_lambda.py (deploy.ps1 runs it)
  website_url = "http://${aws_s3_bucket_website_configuration.site.website_endpoint}"
}

# Strong random values, made up by Terraform (nobody has to pick or type them)
resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

resource "random_password" "admin_password" {
  length      = 20
  special     = false
  min_upper   = 2
  min_lower   = 2
  min_numeric = 2 # our password rule: at least one letter and one number
}

resource "aws_lambda_function" "api" {
  function_name = "${var.name_prefix}-api"
  description   = "Simple Bank FastAPI backend (Mangum)"
  role          = var.lambda_role_arn
  runtime       = "python3.12"
  handler       = "lambda_handler.handler" # file lambda_handler.py, variable handler
  architectures = ["x86_64"]

  filename         = local.lambda_zip
  source_code_hash = filebase64sha256(local.lambda_zip) # new zip contents = new upload

  memory_size = 1024 # more memory also means more CPU: bcrypt password checks run faster
  timeout     = 29   # seconds; API Gateway gives up at 30

  # Settings the app reads with os.getenv(), like backend/.env on your PC
  environment {
    variables = {
      MONGODB_URI     = var.mongodb_uri
      MONGODB_DB      = var.mongodb_db
      JWT_SECRET      = random_password.jwt_secret.result
      ADMIN_USERNAME  = var.admin_username
      ADMIN_PASSWORD  = random_password.admin_password.result
      ALLOWED_ORIGINS = local.website_url # CORS: the S3 website may call the API
      FRONTEND_URL    = local.website_url # reset-password links
    }
  }
}
