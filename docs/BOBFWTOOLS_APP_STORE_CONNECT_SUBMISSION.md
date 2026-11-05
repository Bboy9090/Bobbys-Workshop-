# BobFWTools App Store Connect submission evidence

This lane begins only after the signed Mac App Store package workflow has completed successfully.

The submission workflow is deliberately separate from package creation. An operator supplies the successful package workflow run ID and must type `UPLOAD` exactly. The workflow then:

1. verifies that the referenced run is the BobFWTools Mac App Store Package workflow and completed successfully;
2. downloads the exact owner-private package artifact from that run;
3. checks the package and archive receipts, source revision, package SHA-256, bundle ID, signing evidence, and package signature;
4. materializes an App Store Connect API key only in the temporary runner directory;
5. runs `xcrun altool --validate-app` against the exact signed package;
6. only after validation succeeds, runs `xcrun altool --upload-app` for macOS;
7. emits an owner-private submission receipt tied to the original source SHA, package SHA-256, package workflow run ID, and submission workflow run ID.

Required repository secrets:

- `BOBFW_ASC_API_KEY_ID`
- `BOBFW_ASC_API_ISSUER_ID`
- `BOBFW_ASC_API_KEY_P8_BASE64`

The API key must have App Store Connect permissions sufficient to upload builds.

A green submission workflow proves that the exact package passed Apple's upload validation and that the upload command completed successfully. It does **not** prove that Apple's asynchronous processing has completed, that a version was submitted for review, or that Apple approved the app. Those states remain false in the submission receipt until independently evidenced.
