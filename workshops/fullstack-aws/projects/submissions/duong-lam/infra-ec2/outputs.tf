# Printed after `terraform apply`. See them again any time with `terraform output`.

output "website_url" {
  description = "The live app"
  value       = "https://${aws_cloudfront_distribution.site.domain_name}"
}

output "server_ip" {
  description = "Add this IP in MongoDB Atlas > Network Access, or the API can't reach the database"
  value       = aws_eip.api.public_ip
}

output "admin_username" {
  value = var.admin_username
}

output "admin_password" {
  description = "Show it with: terraform output -raw admin_password"
  value       = random_password.admin_password.result
  sensitive   = true
}

output "github_variables" {
  description = "Add each one in GitHub: repo > Settings > Secrets and variables > Actions > Variables"
  value = {
    AWS_REGION                 = var.region
    AWS_ROLE_ARN               = aws_iam_role.github_deploy.arn
    ECR_REPOSITORY             = aws_ecr_repository.api.name
    EC2_INSTANCE_ID            = aws_instance.api.id
    S3_BUCKET                  = aws_s3_bucket.site.bucket
    CLOUDFRONT_DISTRIBUTION_ID = aws_cloudfront_distribution.site.id
  }
}

output "shell_on_server" {
  description = "Open a shell on the server without SSH (needs the Session Manager plugin for the AWS CLI)"
  value       = "aws ssm start-session --region ${var.region} --target ${aws_instance.api.id}"
}

output "api_logs" {
  description = "Follow the API's log live"
  value       = "aws logs tail ${aws_cloudwatch_log_group.api.name} --follow --region ${var.region}"
}
