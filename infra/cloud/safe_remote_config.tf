resource "aws_secretsmanager_secret" "release_service" {
  name                    = "bobfwtools/release-service"
  description             = "BobFWTools release-service secrets; values are provisioned out-of-band."
  kms_key_id              = aws_kms_key.evidence.arn
  recovery_window_in_days = 30

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_iam_role_policy" "github_release_secret_access" {
  role = aws_iam_role.github_release.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "ReadReleaseServiceSecret"
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
      Resource = aws_secretsmanager_secret.release_service.arn
    }]
  })
}

resource "aws_appconfig_application" "bobfwtools" {
  name        = "bobfwtools"
  description = "Safe remote configuration for BobFWTools diagnostics and release services."
}

resource "aws_appconfig_environment" "production" {
  application_id = aws_appconfig_application.bobfwtools.id
  name           = "production"
  description    = "Production safe configuration. Never grants device-write authority."
}

resource "aws_appconfig_configuration_profile" "safe_runtime" {
  application_id = aws_appconfig_application.bobfwtools.id
  name           = "safe-runtime"
  description    = "Allowlisted non-destructive runtime settings."
  location_uri   = "hosted"

  validator {
    type = "JSON_SCHEMA"
    content = jsonencode({
      "$schema" = "http://json-schema.org/draft-07/schema#"
      type      = "object"
      additionalProperties = false
      required = [
        "schema",
        "diagnosticsEnabled",
        "telemetrySampleRate",
        "cloudPublicationEnabled",
        "catalogRefreshEnabled",
        "releaseChannel",
        "observationConcurrencyLimit",
        "adbObservationTtlMs"
      ]
      properties = {
        schema = {
          const = "com.bobbyblanco.bobfwtools.safe-remote-config.v1"
        }
        diagnosticsEnabled = { type = "boolean" }
        telemetrySampleRate = {
          type    = "number"
          minimum = 0
          maximum = 0.25
        }
        cloudPublicationEnabled = { type = "boolean" }
        catalogRefreshEnabled   = { type = "boolean" }
        releaseChannel = {
          type = "string"
          enum = ["dev", "canary", "qualified", "stable"]
        }
        observationConcurrencyLimit = {
          type    = "integer"
          minimum = 1
          maximum = 4
        }
        adbObservationTtlMs = {
          type    = "integer"
          minimum = 100
          maximum = 5000
        }
      }
    })
  }
}

resource "aws_appconfig_hosted_configuration_version" "safe_runtime" {
  application_id           = aws_appconfig_application.bobfwtools.id
  configuration_profile_id = aws_appconfig_configuration_profile.safe_runtime.configuration_profile_id
  content_type             = "application/json"
  content                  = file("${path.module}/../../resources/remote-config/default.json")
}

resource "aws_appconfig_deployment_strategy" "safe_runtime" {
  name                           = "bobfwtools-safe-linear"
  description                    = "Gradual rollout for non-destructive BobFWTools configuration."
  deployment_duration_in_minutes = 20
  final_bake_time_in_minutes     = 20
  growth_factor                  = 10
  growth_type                    = "LINEAR"
  replicate_to                   = "NONE"
}

resource "aws_iam_role_policy" "github_release_appconfig" {
  role = aws_iam_role.github_release.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "DeploySafeAppConfig"
      Effect = "Allow"
      Action = [
        "appconfig:StartDeployment",
        "appconfig:GetDeployment",
        "appconfig:ListDeployments",
        "appconfig:GetHostedConfigurationVersion"
      ]
      Resource = "*"
    }]
  })
}

output "aws_release_service_secret_arn" {
  value = aws_secretsmanager_secret.release_service.arn
}

output "aws_safe_appconfig_application_id" {
  value = aws_appconfig_application.bobfwtools.id
}
