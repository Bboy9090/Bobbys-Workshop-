output "aws_github_role_arn" {
  value = aws_iam_role.github_release.arn
}

output "aws_evidence_bucket" {
  value = aws_s3_bucket.evidence.bucket
}

output "aws_release_signing_key_arn" {
  value = aws_kms_key.release_signing.arn
}

output "gcp_workload_identity_provider" {
  value = google_iam_workload_identity_pool_provider.github.name
}

output "gcp_service_account" {
  value = google_service_account.github_release.email
}

output "gcp_artifact_repository" {
  value = google_artifact_registry_repository.releases.name
}

output "gcp_release_signing_key" {
  value = google_kms_crypto_key.release_signing.id
}
