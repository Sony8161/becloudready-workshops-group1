# ECR = Elastic Container Registry: AWS's private Docker Hub. GitHub Actions pushes the API image here,
# and the EC2 server pulls it from here.
resource "aws_ecr_repository" "api" {
  name                 = "${var.project}-api"
  image_tag_mutability = "MUTABLE" # the "latest" tag moves to each new build
  force_delete         = true      # lets `terraform destroy` remove it even with images inside

  image_scanning_configuration {
    scan_on_push = true # free scan for known vulnerabilities (CVEs) in every image
  }
}

# Keep only the newest 10 images (old ones cost storage)
resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}
