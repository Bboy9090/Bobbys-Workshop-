# Public release distribution

BobFWTools public downloads are served from a dedicated private S3 bucket through CloudFront Origin Access Control. The immutable evidence vault is never used as a public origin.

Only the GitHub release role can write the `canary/`, `qualified/`, and `stable/` prefixes. Promotion policy must separately prove that the uploaded artifact digest matches the previously qualified artifact; uploading an object does not itself make a release eligible.

The S3 bucket blocks all public access. CloudFront is read-only, HTTPS is enforced, and security response headers are applied at the edge. The first production deployment uses the CloudFront default certificate. AWS fixes that default `*.cloudfront.net` certificate to its `TLSv1` security-policy label regardless of a configured `MinimumProtocolVersion`, so Terraform does not claim a stronger minimum while the default certificate is active.

To enforce `TLSv1.2_2021`, set both `aws_release_custom_domain` and a matching `aws_release_acm_certificate_arn` from ACM in `us-east-1`. Terraform then attaches the alias, uses SNI, disables the default certificate, and explicitly selects `TLSv1.2_2021`. The evidence and promotion trust model is unchanged.
