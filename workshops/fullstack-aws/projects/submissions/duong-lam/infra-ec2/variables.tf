# Inputs. Set the required ones in terraform.tfvars (copy terraform.tfvars.example).

variable "region" {
  description = "AWS region to build in"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Short name used in every resource name"
  type        = string
  default     = "simplebank"
}

variable "instance_type" {
  description = "EC2 size for the API server (t3.micro = 2 vCPU, 1 GB RAM)"
  type        = string
  default     = "t3.micro"
}

variable "mongodb_uri" {
  description = "MongoDB Atlas connection string (same format as MONGODB_URI in backend/.env)"
  type        = string
  sensitive   = true # Terraform hides it in plan/apply output
}

variable "mongodb_db" {
  description = "Database name on AWS. A separate one from local dev, so the public site never has admin/admin123"
  type        = string
  default     = "banking_prod"
}

variable "admin_username" {
  description = "Admin login created on first start (its password is generated, see the admin_password output)"
  type        = string
  default     = "admin"
}

variable "github_repo" {
  description = "owner/repo that is allowed to deploy (GitHub Actions)"
  type        = string
  default     = "Sony8161/BankAPi-fast-api-mongodb"
}

variable "deploy_branch" {
  description = "Only workflows running on this branch may deploy"
  type        = string
  default     = "main"
}

variable "create_github_oidc_provider" {
  description = "Set to false if this AWS account already has the token.actions.githubusercontent.com OIDC provider"
  type        = bool
  default     = true
}

variable "budget_email" {
  description = "Email that gets an alert when the monthly AWS bill passes the budget"
  type        = string
}

variable "monthly_budget_usd" {
  description = "Monthly budget in US dollars"
  type        = number
  default     = 10
}
