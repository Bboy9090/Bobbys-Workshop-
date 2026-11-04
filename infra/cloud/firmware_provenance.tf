data "archive_file" "firmware_provenance" {
  type        = "zip"
  source_file = "${path.module}/lambda/firmware_provenance.py"
  output_path = "${path.module}/firmware-provenance.zip"
}

resource "aws_dynamodb_table" "firmware_source_state" {
  name         = "bobfwtools-firmware-source-state"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "sourceUrlHash"

  attribute {
    name = "sourceUrlHash"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.evidence.arn
  }
}

resource "aws_iam_role" "firmware_provenance_lambda" {
  name = "bobfwtools-firmware-provenance"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "firmware_provenance_lambda" {
  role = aws_iam_role.firmware_provenance_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "${aws_s3_bucket.evidence.arn}/firmware-intake/*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject"]
        Resource = "${aws_s3_bucket.evidence.arn}/firmware-provenance/*"
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey", "kms:DescribeKey"]
        Resource = aws_kms_key.evidence.arn
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:PutItem"]
        Resource = aws_dynamodb_table.firmware_source_state.arn
      }
    ]
  })
}

resource "aws_lambda_function" "firmware_provenance" {
  function_name    = "bobfwtools-firmware-provenance"
  role             = aws_iam_role.firmware_provenance_lambda.arn
  runtime          = "python3.13"
  handler          = "firmware_provenance.handler"
  filename         = data.archive_file.firmware_provenance.output_path
  source_code_hash = data.archive_file.firmware_provenance.output_base64sha256
  timeout          = 300
  memory_size      = 1024

  environment {
    variables = {
      EVIDENCE_KMS_KEY_ARN = aws_kms_key.evidence.arn
      SOURCE_STATE_TABLE   = aws_dynamodb_table.firmware_source_state.name
      VENDOR_SOURCE_HOSTS  = "samsung.com,google.com,developers.google.com,apple.com"
    }
  }
}

resource "aws_lambda_permission" "firmware_intake_s3" {
  statement_id   = "AllowFirmwareIntakeS3"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.firmware_provenance.function_name
  principal      = "s3.amazonaws.com"
  source_arn     = aws_s3_bucket.evidence.arn
  source_account = var.aws_account_id
}

resource "aws_s3_bucket_notification" "firmware_intake" {
  bucket = aws_s3_bucket.evidence.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.firmware_provenance.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "firmware-intake/"
  }

  depends_on = [aws_lambda_permission.firmware_intake_s3]
}
