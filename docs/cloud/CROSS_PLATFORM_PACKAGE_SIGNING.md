# Cross-platform package signing

Windows release artifacts are signed only by the explicit `Windows Authenticode release signing` workflow. It requires a PKCS#12 credential, password, and expected certificate thumbprint, verifies the thumbprint and certificate validity before signing, uses SHA-256 plus an RFC3161 timestamp, and then requires both `signtool verify` and `Get-AuthenticodeSignature` to report a valid signature. No credential is committed to the repository.

Linux release artifacts use keyless Sigstore/Cosign signing through GitHub OIDC. The workflow pins `cosign-installer` v4.1.2 by commit and explicitly installs Cosign v3.1.4. Verification requires the exact BobFWTools workflow identity on `feat/bobfwtools-macos-foundation` and GitHub's OIDC issuer. The Sigstore bundle and a fail-closed signing receipt are retained with the artifact.

These signing workflows produce platform evidence only. They do not grant release promotion or physical-device write authority, and signed artifact digests must feed the provenance/policy pipeline after signing.
