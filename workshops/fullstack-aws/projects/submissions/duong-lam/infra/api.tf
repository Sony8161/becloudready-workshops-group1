# API Gateway (HTTP API): the public HTTPS address of the backend.
# One route catches every /api/... path and method and hands it to the Lambda;
# FastAPI does the real routing, exactly like it does on your PC.

resource "aws_apigatewayv2_api" "http" {
  name          = "${var.name_prefix}-http-api"
  protocol_type = "HTTP"
  description   = "Simple Bank: ANY /api/* -> Lambda"
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY" # pass the whole request through, untouched
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 29000
}

resource "aws_apigatewayv2_route" "api" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "ANY /api/{proxy+}" # GET, POST, PUT, PATCH, DELETE, OPTIONS on /api/anything
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default" # no /prod or /dev in the URL
  auto_deploy = true       # route changes go live right away

  # Throttling: caps requests per second across the whole API (slows down brute force and runaway bills)
  default_route_settings {
    throttling_burst_limit = 50
    throttling_rate_limit  = 25
  }
}

# Lambda's own permission list: allow THIS API (and nothing else) to call the function
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowApiGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}
