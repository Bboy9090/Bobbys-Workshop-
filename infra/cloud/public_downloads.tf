resource "aws_s3_bucket" "release_downloads" {
  bucket = var.aws_release_bucket_name

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "release_downloads" {
  bucket = aws_s3_bucket.release_downloads.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "release_downloads" {
  bucket = aws_s3_bucket.release_downloads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "release_downloads" {
  bucket = aws_s3_bucket.release_downloads.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_cloudfront_origin_access_control" "release_downloads" {
  name                              = "bobfwtools-release-downloads"
  description                       = "CloudFront-only access to promoted BobFWTools release artifacts"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_response_headers_policy" "release_downloads" {
  name = "bobfwtools-release-download-security"

  security_headers_config {
    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "DENY"
      override     = true
    }

    referrer_policy {
      referrer_policy = "no-referrer"
      override        = true
    }

    strict_transport_security {
      access_control_max_age_sec = 63072000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }

    xss_protection {
      mode_block = true
      protection = true
      override   = true
    }
  }
}

resource "aws_cloudfront_distribution" "release_downloads" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "BobFWTools promoted release downloads"
  price_class     = "PriceClass_100"
  http_version    = "http2and3"

  origin {
    domain_name              = aws_s3_bucket.release_downloads.bucket_regional_domain_name
    origin_id                = "bobfwtools-release-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.release_downloads.id
  }

  default_cache_behavior {
    target_origin_id       = "bobfwtools-release-s3"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    compress               = true

    cache_policy_id            = data.aws_cloudfront_cache_policy.caching_optimized.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.release_downloads.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
    minimum_protocol_version       = "TLSv1.2_2021"
  }
}

data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

resource "aws_s3_bucket_policy" "release_downloads" {
  bucket = aws_s3_bucket.release_downloads.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFrontReadOnly"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.release_downloads.arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.release_downloads.arn
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_release_download_promotion" {
  role = aws_iam_role.github_release.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "PromotedReleaseBucketMetadata"
        Effect   = "Allow"
        Action   = ["s3:ListBucket", "s3:GetBucketVersioning"]
        Resource = aws_s3_bucket.release_downloads.arn
        Condition = {
          StringLike = {
            "s3:prefix" = ["canary/*", "qualified/*", "stable/*"]
          }
        }
      },
      {
        Sid      = "PromotedReleaseObjects"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:GetObjectVersion", "s3:PutObject"]
        Resource = [
          "${aws_s3_bucket.release_downloads.arn}/canary/*",
          "${aws_s3_bucket.release_downloads.arn}/qualified/*",
          "${aws_s3_bucket.release_downloads.arn}/stable/*"
        ]
      }
    ]
  })
}

output "aws_release_download_distribution_domain" {
  value = aws_cloudfront_distribution.release_downloads.domain_name
}
