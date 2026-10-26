#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TF_DIR="$ROOT/infra/cloud"
export TF_VAR_aws_account_id="${TF_VAR_aws_account_id:-960763460596}"
export TF_VAR_aws_evidence_bucket_name="${TF_VAR_aws_evidence_bucket_name:-bobfwtools-evidence-960763460596-us-east-1}"
export TF_VAR_aws_release_bucket_name="${TF_VAR_aws_release_bucket_name:-bobfwtools-releases-960763460596-us-east-1}"
export TF_VAR_gcp_project_id="${TF_VAR_gcp_project_id:-bobfwtools-prod-20261026}"

require() { command -v "$1" >/dev/null || { echo "Missing required command: $1" >&2; exit 1; }; }
require aws
require terraform

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
[[ "$ACCOUNT" == "$TF_VAR_aws_account_id" ]] || { echo "Wrong AWS account: $ACCOUNT" >&2; exit 1; }

terraform -chdir="$TF_DIR" init -input=false

import_if_missing() {
  local address="$1" id="$2"
  if terraform -chdir="$TF_DIR" state show "$address" >/dev/null 2>&1; then
    echo "already managed: $address"
  else
    echo "importing: $address"
    terraform -chdir="$TF_DIR" import -input=false "$address" "$id"
  fi
}

OIDC_ARN="arn:aws:iam::$ACCOUNT:oidc-provider/token.actions.githubusercontent.com"
EVIDENCE_KEY_ID="$(aws kms describe-key --key-id alias/bobfwtools-evidence --query KeyMetadata.KeyId --output text)"
SIGNING_KEY_ID="$(aws kms describe-key --key-id alias/bobfwtools-release-signing --query KeyMetadata.KeyId --output text)"

import_if_missing aws_iam_openid_connect_provider.github "$OIDC_ARN"
import_if_missing aws_kms_key.evidence "$EVIDENCE_KEY_ID"
import_if_missing aws_kms_alias.evidence alias/bobfwtools-evidence
import_if_missing aws_kms_key.release_signing "$SIGNING_KEY_ID"
import_if_missing aws_kms_alias.release_signing alias/bobfwtools-release-signing
import_if_missing aws_s3_bucket.evidence "$TF_VAR_aws_evidence_bucket_name"
import_if_missing aws_s3_bucket_versioning.evidence "$TF_VAR_aws_evidence_bucket_name"
import_if_missing aws_s3_bucket_server_side_encryption_configuration.evidence "$TF_VAR_aws_evidence_bucket_name"
import_if_missing aws_s3_bucket_object_lock_configuration.evidence "$TF_VAR_aws_evidence_bucket_name"
import_if_missing aws_s3_bucket_public_access_block.evidence "$TF_VAR_aws_evidence_bucket_name"
import_if_missing aws_iam_role.github_release bobfwtools-github-release
import_if_missing aws_iam_role_policy.github_release bobfwtools-github-release:bobfwtools-release-foundation

echo "Bootstrap foundation adopted into remote Terraform state. Run terraform plan before any apply."
