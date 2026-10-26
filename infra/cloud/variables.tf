variable "github_repository" { type = string, default = "Bboy9090/Bobbys-Workshop-" }
variable "github_release_ref" { type = string, default = "refs/heads/feat/bobfwtools-macos-foundation" }
variable "aws_region" { type = string, default = "us-east-1" }
variable "aws_account_id" { type = string }
variable "aws_evidence_bucket_name" { type = string }
variable "gcp_project_id" { type = string }
variable "gcp_region" { type = string, default = "us-east1" }
variable "gcp_artifact_repository_id" { type = string, default = "bobfwtools-releases" }
variable "gcp_bigquery_dataset_id" { type = string, default = "bobfwtools_release_evidence" }
