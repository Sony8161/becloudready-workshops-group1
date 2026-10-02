# App settings for the API server, stored in SSM Parameter Store (not in code, not in the image).
# The server reads everything under /simplebank/ when the container starts (see user_data.sh.tftpl).

locals {
  param_path = "/${var.project}"
}

# Terraform makes up strong random values, so no human ever picks (or sees) them
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

# Shared secret between CloudFront and the API: proves a request came through CloudFront
resource "random_password" "origin_secret" {
  length  = 40
  special = false
}

# SecureString = encrypted at rest with AWS KMS
locals {
  secret_settings = {
    MONGODB_URI    = var.mongodb_uri
    JWT_SECRET     = random_password.jwt_secret.result
    ADMIN_PASSWORD = random_password.admin_password.result
    ORIGIN_SECRET  = random_password.origin_secret.result
  }
}

resource "aws_ssm_parameter" "secret" {
  # loop over the NAMES (plain text); Terraform won't loop over secret values directly
  for_each = toset(["MONGODB_URI", "JWT_SECRET", "ADMIN_PASSWORD", "ORIGIN_SECRET"])

  name  = "${local.param_path}/${each.key}"
  type  = "SecureString"
  value = local.secret_settings[each.key]
}

# Plain (non-secret) settings
resource "aws_ssm_parameter" "setting" {
  for_each = {
    MONGODB_DB      = var.mongodb_db
    ADMIN_USERNAME  = var.admin_username
    FRONTEND_URL    = "https://${aws_cloudfront_distribution.site.domain_name}" # reset-password links
    ALLOWED_ORIGINS = "https://${aws_cloudfront_distribution.site.domain_name}"
  }

  name  = "${local.param_path}/${each.key}"
  type  = "String"
  value = each.value
}
