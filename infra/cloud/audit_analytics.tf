locals {
  release_audit_trail_name = "bobfwtools-release-audit"
  release_audit_trail_arn  = "arn:aws:cloudtrail:${var.aws_region}:${var.aws_account_id}:trail/${local.release_audit_trail_name}"
}

resource "google_bigquery_table" "qualification_receipts" {
  dataset_id          = google_bigquery_dataset.release_evidence.dataset_id
  table_id            = "qualification_receipts"
  deletion_protection = true

  schema = jsonencode([
    { name = "receipt_id", type = "STRING", mode = "REQUIRED" },
    { name = "received_at", type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "source_revision", type = "STRING", mode = "REQUIRED" },
    { name = "artifact_sha256", type = "STRING", mode = "REQUIRED" },
    { name = "provenance_sha256", type = "STRING", mode = "REQUIRED" },
    { name = "platform", type = "STRING", mode = "REQUIRED" },
    { name = "status", type = "STRING", mode = "REQUIRED" },
    { name = "evidence_json", type = "JSON", mode = "NULLABLE" },
    { name = "execution_performed", type = "BOOLEAN", mode = "REQUIRED" },
    { name = "device_write_authority_granted", type = "BOOLEAN", mode = "REQUIRED" },
    { name = "receipt_sha256", type = "STRING", mode = "REQUIRED" }
  ])

  time_partitioning {
    type  = "DAY"
    field = "received_at"
  }

  clustering = ["platform", "status"]
}

resource "google_bigquery_table" "release_policy_results" {
  dataset_id          = google_bigquery_dataset.release_evidence.dataset_id
  table_id            = "release_policy_results"
  deletion_protection = true

  schema = jsonencode([
    { name = "evaluated_at", type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "source_revision", type = "STRING", mode = "REQUIRED" },
    { name = "artifact_sha256", type = "STRING", mode = "REQUIRED" },
    { name = "requested_channel", type = "STRING", mode = "REQUIRED" },
    { name = "release_eligible", type = "BOOLEAN", mode = "REQUIRED" },
    { name = "reasons", type = "STRING", mode = "REPEATED" },
    { name = "device_write_authority_granted", type = "BOOLEAN", mode = "REQUIRED" }
  ])

  time_partitioning {
    type  = "DAY"
    field = "evaluated_at"
  }
}

resource "google_logging_project_sink" "release_security_audit" {
  name                   = "bobfwtools-release-security-audit"
  destination            = "bigquery.googleapis.com/projects/${var.gcp_project_id}/datasets/${google_bigquery_dataset.release_evidence.dataset_id}"
  filter                 = <<-EOT
    protoPayload.serviceName=("artifactregistry.googleapis.com" OR "cloudkms.googleapis.com" OR "iam.googleapis.com" OR "secretmanager.googleapis.com")
  EOT
  unique_writer_identity = true
}

resource "google_bigquery_dataset_iam_member" "audit_sink_writer" {
  dataset_id = google_bigquery_dataset.release_evidence.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = google_logging_project_sink.release_security_audit.writer_identity
}

resource "aws_s3_bucket_policy" "evidence_cloudtrail" {
  bucket = aws_s3_bucket.evidence.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AWSCloudTrailAclCheck"
        Effect    = "Allow"
        Principal = { Service = "cloudtrail.amazonaws.com" }
        Action    = "s3:GetBucketAcl"
        Resource  = aws_s3_bucket.evidence.arn
        Condition = { StringEquals = { "AWS:SourceArn" = local.release_audit_trail_arn } }
      },
      {
        Sid       = "AWSCloudTrailWrite"
        Effect    = "Allow"
        Principal = { Service = "cloudtrail.amazonaws.com" }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.evidence.arn}/cloudtrail/AWSLogs/${var.aws_account_id}/*"
        Condition = {
          StringEquals = {
            "s3:x-amz-acl"  = "bucket-owner-full-control"
            "AWS:SourceArn" = local.release_audit_trail_arn
          }
        }
      }
    ]
  })
}

resource "aws_cloudtrail" "release_audit" {
  name                          = local.release_audit_trail_name
  s3_bucket_name                = aws_s3_bucket.evidence.id
  s3_key_prefix                 = "cloudtrail"
  include_global_service_events = true
  is_multi_region_trail         = true
  enable_log_file_validation    = true
  kms_key_id                    = aws_kms_key.evidence.arn

  depends_on = [aws_s3_bucket_policy.evidence_cloudtrail, aws_kms_key_policy.evidence_services]
}

resource "aws_cloudwatch_log_group" "release_security_events" {
  name              = "/bobfwtools/release-security-events"
  retention_in_days = 90
  kms_key_id        = aws_kms_key.evidence.arn
}

resource "aws_cloudwatch_log_resource_policy" "eventbridge_to_logs" {
  policy_name = "bobfwtools-eventbridge-to-release-audit"
  policy_document = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = ["events.amazonaws.com", "delivery.logs.amazonaws.com"] }
      Action    = ["logs:CreateLogStream", "logs:PutLogEvents"]
      Resource  = "${aws_cloudwatch_log_group.release_security_events.arn}:*"
    }]
  })
}

resource "aws_cloudwatch_event_rule" "release_security_api_calls" {
  name        = "bobfwtools-release-security-api-calls"
  description = "Route security-sensitive BobFWTools cloud API activity into an auditable log group."

  event_pattern = jsonencode({
    "detail-type" = ["AWS API Call via CloudTrail"]
    source = [
      "aws.iam",
      "aws.kms",
      "aws.s3",
      "aws.lambda",
      "aws.apigateway"
    ]
  })
}

resource "aws_cloudwatch_event_target" "release_security_logs" {
  rule = aws_cloudwatch_event_rule.release_security_api_calls.name
  arn  = aws_cloudwatch_log_group.release_security_events.arn

  depends_on = [aws_cloudwatch_log_resource_policy.eventbridge_to_logs]
}

locals {
  release_security_log_group_arn = "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/bobfwtools/release-security-events"
}

resource "aws_kms_key_policy" "evidence_services" {
  key_id = aws_kms_key.evidence.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnableAccountAdministration"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${var.aws_account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "AllowCloudTrailEncryption"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action = [
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = local.release_audit_trail_arn
          }
        }
      },
      {
        Sid    = "AllowCloudWatchLogsEncryption"
        Effect = "Allow"
        Principal = {
          Service = "logs.${var.aws_region}.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
        Condition = {
          ArnEquals = {
            "kms:EncryptionContext:aws:logs:arn" = local.release_security_log_group_arn
          }
        }
      }
    ]
  })
}
