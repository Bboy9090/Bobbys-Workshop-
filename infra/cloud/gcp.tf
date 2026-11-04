data "google_project" "current" {
  project_id = var.gcp_project_id
}

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "bobfwtools-github"
  display_name              = "BobFWTools GitHub Actions"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  display_name                       = "GitHub OIDC"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  attribute_condition = "assertion.repository == '${var.github_repository}' && assertion.ref == '${var.github_release_ref}'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account" "github_release" {
  account_id   = "bobfwtools-github-release"
  display_name = "BobFWTools GitHub release federation"
}

resource "google_service_account_iam_member" "github_wif" {
  service_account_id = google_service_account.github_release.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/projects/${data.google_project.current.number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github.workload_identity_pool_id}/attribute.repository/${var.github_repository}"
}

resource "google_artifact_registry_repository" "releases" {
  location      = var.gcp_region
  repository_id = var.gcp_artifact_repository_id
  description   = "BobFWTools release and provenance mirror"
  format        = "GENERIC"
}

resource "google_artifact_registry_repository_iam_member" "writer" {
  location   = google_artifact_registry_repository.releases.location
  repository = google_artifact_registry_repository.releases.repository_id
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.github_release.email}"
}

resource "google_bigquery_dataset" "release_evidence" {
  dataset_id                 = var.gcp_bigquery_dataset_id
  location                   = "US"
  delete_contents_on_destroy = false
}

resource "google_bigquery_dataset_iam_member" "writer" {
  dataset_id = google_bigquery_dataset.release_evidence.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = "serviceAccount:${google_service_account.github_release.email}"
}

resource "google_kms_key_ring" "release" {
  name     = "bobfwtools-release"
  location = var.gcp_region
}

resource "google_kms_crypto_key" "release_signing" {
  name     = "provenance-signing"
  key_ring = google_kms_key_ring.release.id
  purpose  = "ASYMMETRIC_SIGN"

  version_template {
    algorithm = "EC_SIGN_P256_SHA256"
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_kms_crypto_key_iam_member" "signer" {
  crypto_key_id = google_kms_crypto_key.release_signing.id
  role          = "roles/cloudkms.signerVerifier"
  member        = "serviceAccount:${google_service_account.github_release.email}"
}

resource "google_secret_manager_secret" "release_config" {
  secret_id = "bobfwtools-release-config"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_iam_member" "release_config_accessor" {
  secret_id = google_secret_manager_secret.release_config.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.github_release.email}"
}
