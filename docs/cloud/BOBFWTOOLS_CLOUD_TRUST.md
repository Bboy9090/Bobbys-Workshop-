# BobFWTools Cloud Trust Foundation

This layer is intentionally release/evidence infrastructure only. It does not grant device-write authority.

- GitHub Actions authenticates to AWS and Google with OIDC/WIF; no static cloud keys are required.
- AWS S3 stores immutable versioned evidence with Object Lock and KMS encryption.
- AWS asymmetric KMS signs provenance manifests.
- Google Artifact Registry mirrors release artifacts.
- BigQuery stores normalized release/evidence analytics.
- Google Cloud KMS provides an independent provenance signature path.
- Secret Manager stores release-service configuration, not destructive-device authorization.

Production apply is separate from plan. Never run Terraform under the AWS account root identity. Use a bootstrap/admin role to establish OIDC, then use the generated least-privilege release role for CI.
