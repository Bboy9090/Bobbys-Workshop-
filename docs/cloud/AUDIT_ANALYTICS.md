# Audit and analytics foundation

BobFWTools keeps operational analytics separate from immutable source evidence.

- BigQuery tables normalize qualification receipts and release-policy outcomes for analysis.
- A Google Cloud Logging sink captures Artifact Registry, KMS, IAM, and Secret Manager audit activity into the release-evidence dataset.
- AWS CloudTrail writes validated multi-region audit logs into the Object-Locked evidence bucket.
- EventBridge routes IAM/KMS/S3/Lambda/API Gateway API activity to a KMS-protected CloudWatch log group for faster operational review.

None of these analytics paths grant release promotion or physical-device execution authority.
