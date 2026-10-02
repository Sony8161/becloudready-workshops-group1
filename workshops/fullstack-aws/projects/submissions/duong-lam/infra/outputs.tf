# Printed after `terraform apply`. See them again any time: `terraform output`

output "website_url" {
  description = "The live app"
  value       = local.website_url
}

output "api_url" {
  description = "The backend's public address (try <api_url>/api/health)"
  value       = aws_apigatewayv2_api.http.api_endpoint
}

output "vite_api_url" {
  description = "What the React build uses as VITE_API_URL"
  value       = "${aws_apigatewayv2_api.http.api_endpoint}/api"
}

output "admin_username" {
  value = var.admin_username
}

output "admin_password" {
  description = "Show it with: terraform output -raw admin_password"
  value       = random_password.admin_password.result
  sensitive   = true
}

output "lambda_function" {
  value = aws_lambda_function.api.function_name
}

output "site_bucket" {
  value = aws_s3_bucket.site.bucket
}

output "api_logs" {
  description = "Follow the API's log live"
  value       = "aws logs tail /aws/lambda/${aws_lambda_function.api.function_name} --follow"
}

output "github_variables" {
  description = "For the GitHub Actions deploy: repo > Settings > Secrets and variables > Actions > Variables"
  value = {
    AWS_REGION      = var.region
    LAMBDA_FUNCTION = aws_lambda_function.api.function_name
    S3_BUCKET       = aws_s3_bucket.site.bucket
    VITE_API_URL    = "${aws_apigatewayv2_api.http.api_endpoint}/api"
  }
}
