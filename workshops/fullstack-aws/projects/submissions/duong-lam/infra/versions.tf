# Serverless version for the QuickLabs lab account: S3 (website) + Lambda (API) + API Gateway.
terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
  # State (Terraform's record of what it built) stays on your PC in infra/terraform.tfstate.
  # It's git-ignored because it contains the generated passwords and your MongoDB URI.
}

provider "aws" {
  region = var.region
}
