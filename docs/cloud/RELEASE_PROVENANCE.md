# Release provenance contract

Every release artifact is paired with a versioned JSON provenance manifest and an SBOM digest. Verification is fail-closed: artifact, SBOM, or manifest drift invalidates the receipt.

The unsigned manifest explicitly carries `deviceWriteAuthorityGranted:false` and `releasePromotionGranted:false`. Later KMS/Sigstore signatures attest integrity; they do not grant device-write authority.

The next wiring stage signs the manifest digest with the dedicated AWS and Google Cloud KMS keys, stores the evidence bundle in the Object-Locked S3 vault, and mirrors approved artifacts to Google Artifact Registry.
