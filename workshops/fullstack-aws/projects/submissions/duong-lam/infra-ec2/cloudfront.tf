# CloudFront = AWS's CDN and the ONE public address of the app (https://dxxxx.cloudfront.net).
#   /api/*        -> the EC2 API server (never cached)
#   everything else -> the React files in S3 (cached at edge locations worldwide)
# Same address for both, so the browser never needs CORS. Free HTTPS certificate included.

# React Router owns paths like /app and /admin/customers. Those aren't files in S3,
# so this tiny function (runs at the edge on every request) serves index.html for them.
resource "aws_cloudfront_function" "spa_routes" {
  name    = "${var.project}-spa-routes"
  runtime = "cloudfront-js-2.0"
  comment = "Paths without a file extension get index.html (React Router)"
  publish = true
  code    = <<-JS
    function handler(event) {
      var request = event.request;
      if (request.uri.indexOf('.') === -1) {
        request.uri = '/index.html';
      }
      return request;
    }
  JS
}

# AWS-managed policies (looked up by name)
data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_response_headers_policy" "security_headers" {
  name = "Managed-SecurityHeadersPolicy" # HSTS, X-Frame-Options, nosniff... on the website
}

# API cache policy: never cache (TTL 0), but the Authorization header (the JWT) must reach the API
resource "aws_cloudfront_cache_policy" "api" {
  name        = "${var.project}-api-no-cache"
  comment     = "API: no caching, pass the Bearer token through"
  min_ttl     = 0
  default_ttl = 0
  max_ttl     = 1 # must be above 0 to forward headers; the API also sends Cache-Control: no-store

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true
    headers_config {
      header_behavior = "whitelist"
      headers {
        items = ["Authorization"]
      }
    }
    cookies_config {
      cookie_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "all" # ?page=2&search=jane
    }
  }
}

# What else CloudFront passes to the API: all browser headers, plus the visitor's real IP
# (CloudFront-Viewer-Address) for the rate limits and the sign-in log
resource "aws_cloudfront_origin_request_policy" "api" {
  name    = "${var.project}-api"
  comment = "API: all viewer headers + CloudFront-Viewer-Address"

  headers_config {
    header_behavior = "allViewerAndWhitelistCloudFront"
    headers {
      items = ["CloudFront-Viewer-Address"]
    }
  }
  cookies_config {
    cookie_behavior = "none"
  }
  query_strings_config {
    query_string_behavior = "all"
  }
}

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  comment             = "Simple Bank: React site + /api"
  default_root_object = "index.html"
  is_ipv6_enabled     = true
  http_version        = "http2and3"
  price_class         = "PriceClass_100" # US, Canada, Europe edge locations only (cheapest)

  # Origin 1: the website files
  origin {
    origin_id                = "site"
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  # Origin 2: the API server
  origin {
    origin_id   = "api"
    domain_name = aws_eip.api.public_dns

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only" # CloudFront -> EC2 on port 80 (visitors -> CloudFront is HTTPS)
      origin_ssl_protocols   = ["TLSv1.2"]
    }

    # The secret the API checks (ORIGIN_SECRET), so nobody can skip CloudFront
    custom_header {
      name  = "X-Origin-Verify"
      value = random_password.origin_secret.result
    }
  }

  # Default: the React website
  default_cache_behavior {
    target_origin_id           = "site"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.caching_optimized.id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security_headers.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_routes.arn
    }
  }

  # /api/*: the backend
  ordered_cache_behavior {
    path_pattern             = "/api/*"
    target_origin_id         = "api"
    viewer_protocol_policy   = "https-only"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    compress                 = true
    cache_policy_id          = aws_cloudfront_cache_policy.api.id
    origin_request_policy_id = aws_cloudfront_origin_request_policy.api.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true # free *.cloudfront.net HTTPS certificate
  }
}
