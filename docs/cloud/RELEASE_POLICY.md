# Release promotion policy

Promotion is fail-closed and digest-preserving. The policy engine requires verified provenance, SBOM, dependency and malware gates, platform package evidence, platform signing, dual-cloud KMS provenance signatures, and channel-specific promotion evidence.

`stable` requires a canary observation and explicit human approval. `qualified` requires explicit human approval. Promotion must reuse the exact qualified artifact digest; a rebuild is rejected.

Release promotion and physical-device write authorization are separate trust domains. This policy always returns `deviceWriteAuthorityGranted:false`.
