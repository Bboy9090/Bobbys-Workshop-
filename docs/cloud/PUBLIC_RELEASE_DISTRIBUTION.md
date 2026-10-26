# Public release distribution

BobFWTools public downloads are served from a dedicated private S3 bucket through CloudFront Origin Access Control. The immutable evidence vault is never used as a public origin.

Only the GitHub release role can write the `canary/`, `qualified/`, and `stable/` prefixes. Promotion policy must separately prove that the uploaded artifact digest matches the previously qualified artifact; uploading an object does not itself make a release eligible.

The S3 bucket blocks all public access. CloudFront is read-only, HTTPS is enforced, and security response headers are applied at the edge. The first production deployment uses the CloudFront default certificate; a custom domain and ACM certificate can be attached later without changing the evidence or promotion trust model.
