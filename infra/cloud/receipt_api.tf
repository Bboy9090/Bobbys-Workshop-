data "archive_file" "qualification_receipt" {
  type        = "zip"
  source_file = "${path.module}/lambda/qualification_receipt.py"
  output_path = "${path.module}/qualification-receipt.zip"
}

resource "aws_iam_role" "qualification_receipt_lambda" {
  name = "bobfwtools-qualification-receipt-api"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "qualification_receipt_lambda" {
  role = aws_iam_role.qualification_receipt_lambda.id
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
        Action   = ["s3:PutObject"]
        Resource = "${aws_s3_bucket.evidence.arn}/qualification-receipts/*"
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Encrypt", "kms:GenerateDataKey", "kms:DescribeKey"]
        Resource = aws_kms_key.evidence.arn
      }
    ]
  })
}

resource "aws_lambda_function" "qualification_receipt" {
  function_name    = "bobfwtools-qualification-receipt"
  role             = aws_iam_role.qualification_receipt_lambda.arn
  runtime          = "python3.13"
  handler          = "qualification_receipt.handler"
  filename         = data.archive_file.qualification_receipt.output_path
  source_code_hash = data.archive_file.qualification_receipt.output_base64sha256
  timeout          = 10
  memory_size      = 256

  environment {
    variables = {
      EVIDENCE_BUCKET      = aws_s3_bucket.evidence.bucket
      EVIDENCE_KMS_KEY_ARN = aws_kms_key.evidence.arn
    }
  }
}

resource "aws_apigatewayv2_api" "qualification_receipt" {
  name          = "bobfwtools-qualification-receipts"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "qualification_receipt" {
  api_id                 = aws_apigatewayv2_api.qualification_receipt.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.qualification_receipt.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "qualification_receipt" {
  api_id             = aws_apigatewayv2_api.qualification_receipt.id
  route_key          = "POST /v1/qualification-receipts"
  authorization_type = "AWS_IAM"
  target             = "integrations/${aws_apigatewayv2_integration.qualification_receipt.id}"
}

resource "aws_apigatewayv2_stage" "qualification_receipt" {
  api_id      = aws_apigatewayv2_api.qualification_receipt.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 20
    throttling_rate_limit  = 10
  }
}

resource "aws_lambda_permission" "qualification_receipt_api" {
  statement_id  = "AllowApiGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.qualification_receipt.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.qualification_receipt.execution_arn}/*/*"
}

resource "aws_iam_role_policy" "github_release_receipt_api" {
  role = aws_iam_role.github_release.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "execute-api:Invoke"
      Resource = "${aws_apigatewayv2_api.qualification_receipt.execution_arn}/*/POST/v1/qualification-receipts"
    }]
  })
}

output "aws_qualification_receipt_api_endpoint" {
  value = aws_apigatewayv2_api.qualification_receipt.api_endpoint
}
