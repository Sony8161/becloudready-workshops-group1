# Inputs. Put the required one (mongodb_uri) in terraform.tfvars (copy terraform.tfvars.example).

variable "region" {
  description = "AWS region (the lab uses us-east-1)"
  type        = string
  default     = "us-east-1"
}

variable "name_prefix" {
  description = "Start of every resource name. The lab account is shared, so it includes your name"
  type        = string
  default     = "duonglam-simplebank"
}

variable "lambda_role_arn" {
  description = "Execution role for the Lambda. The lab doesn't let us create roles, so we use the one made for our batch"
  type        = string
  default     = "arn:aws:iam::279249498881:role/quicklabs-fullstack-aws-28sep-batch-a-lambda-exec"
}

variable "mongodb_uri" {
  description = "MongoDB Atlas connection string (same format as MONGODB_URI in backend/.env)"
  type        = string
  sensitive   = true # hidden in plan/apply output
}

variable "mongodb_db" {
  description = "Database name for the deployed app. Separate from local dev, so the public site never has admin/admin123"
  type        = string
  default     = "banking_prod"
}

variable "admin_username" {
  description = "Admin login created on first start (password is generated: see the admin_password output)"
  type        = string
  default     = "admin"
}
