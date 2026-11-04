# Terraform remote state and bootstrap adoption

BobFWTools production infrastructure uses a dedicated S3 backend: `bobfwtools-terraform-state-960763460596-us-east-1`, key `bobfwtools/prod/terraform.tfstate`. The bucket is versioned, blocks all public access, and uses the BobFWTools evidence KMS key for default encryption. Terraform's S3 lockfile is enabled.

The initial GitHub OIDC provider, evidence/signing KMS keys, Object-Locked evidence bucket, and GitHub release role were bootstrapped before remote state existed. They must be **imported**, not recreated. `scripts/cloud/adopt-live-foundation.sh` verifies AWS account `960763460596`, initializes the remote backend, and idempotently imports those exact resources.

The adoption script never applies infrastructure. After import, inspect a full `terraform plan` before any apply. GCP billable resources remain blocked until `bobfwtools-prod-20261026` can be linked to billing; do not weaken or bypass that gate.
