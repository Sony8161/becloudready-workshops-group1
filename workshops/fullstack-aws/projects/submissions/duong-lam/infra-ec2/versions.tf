# Which Terraform and which "providers" (plugins that talk to AWS etc.) this project needs.
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

  # STATE: Terraform's record of what it built. For now it lives on your PC in infra-ec2/terraform.tfstate
  # (git-ignored, because it contains the generated passwords). For a team, keep it in an encrypted
  # S3 bucket instead, so everyone shares one copy:
  # backend "s3" {
  #   bucket       = "simplebank-tfstate-<your account id>"
  #   key          = "simplebank/terraform.tfstate"
  #   region       = "us-east-1"
  #   encrypt      = true
  #   use_lockfile = true   # stops two people applying at the same time
  # }
}

provider "aws" {
  region = var.region

  # Every resource gets these tags, so you can find (and cost-track) everything this project made
  default_tags {
    tags = {
      Project   = var.project
      ManagedBy = "terraform"
    }
  }
}
