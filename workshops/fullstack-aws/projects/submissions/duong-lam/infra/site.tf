# The React website: S3 "static website hosting". S3 serves the built files (index.html, assets/...)
# directly to browsers at http://<bucket>.s3-website-us-east-1.amazonaws.com

resource "aws_s3_bucket" "site" {
  bucket        = "${var.name_prefix}-site" # bucket names are global across all of AWS
  force_destroy = true                      # `terraform destroy` empties it first
}

# New buckets block public access by default. A public website needs it off for THIS bucket.
resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_website_configuration" "site" {
  bucket = aws_s3_bucket.site.id

  index_document {
    suffix = "index.html"
  }

  # React Router: /app or /admin aren't real files, so S3 answers with index.html and React
  # shows the right page (the browser still gets the page, just with a 404 status)
  error_document {
    key = "index.html"
  }
}

# Anyone may READ files (it's a public website). Only you can upload or delete.
resource "aws_s3_bucket_policy" "public_read" {
  bucket = aws_s3_bucket.site.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "PublicReadWebsite"
      Effect    = "Allow"
      Principal = "*"
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.site.arn}/*"
    }]
  })
  depends_on = [aws_s3_bucket_public_access_block.site]
}
