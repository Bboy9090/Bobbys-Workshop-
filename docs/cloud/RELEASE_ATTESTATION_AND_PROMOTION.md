# KMS attestation and digest-preserving promotion

AWS release attestation signs the SHA-256 digest of the exact provenance manifest bytes with `alias/bobfwtools-release-signing` using ECDSA P-256/SHA-256. The resulting receipt is independently verified against the KMS public key and copied into the Object-Locked evidence bucket. Attestation never grants promotion or physical-device write authority.

Promotion is a separate manual workflow. It accepts only a release-policy result already marked eligible for the requested channel and the matching release-candidate evidence. It downloads the source artifact from private S3, recomputes SHA-256 locally, rejects any mismatch, and then copies those same bytes into the private CloudFront origin under `canary/`, `qualified/`, or `stable/`. It never rebuilds.

The policy engine continues to require both AWS and Google Cloud KMS verification for release eligibility. AWS signing being available does not weaken that dual-signature requirement; stable/qualified promotion remains fail-closed until the dedicated GCP project can provision its KMS signing key.
