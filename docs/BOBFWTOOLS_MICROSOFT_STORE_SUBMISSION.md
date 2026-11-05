# BobFWTools Microsoft Store submission evidence

This lane begins after the signed Microsoft Store MSIX workflow completes successfully.

The submission workflow is deliberately separate from package creation. An operator supplies the exact successful MSIX workflow run ID, the existing Partner Center application ID, and must type `SUBMIT` exactly. The workflow then:

1. verifies the referenced run is a manually dispatched successful **BobFWTools Microsoft Store MSIX** run;
2. downloads the exact source-bound private artifact and verifies the signed MSIX SHA-256 against `MICROSOFT-STORE-RECEIPT.json`;
3. obtains a Microsoft Entra service-to-service token using the Partner Center-associated application;
4. creates a new submission for the existing Microsoft Store app;
5. updates that submission so the exact MSIX is `PendingUpload`;
6. uploads a ZIP containing that MSIX to the submission's Microsoft-provided SAS URL;
7. commits the submission and polls initial Partner Center status;
8. writes an owner-private receipt containing source SHA, package workflow run ID, package SHA-256, application ID, submission ID, and Microsoft-reported status.

Required repository secrets:

- `BOBFW_MS_STORE_TENANT_ID`
- `BOBFW_MS_STORE_CLIENT_ID`
- `BOBFW_MS_STORE_CLIENT_SECRET`

Partner Center prerequisites remain external: the app name/application must already exist, the Entra application must be associated with Partner Center with suitable rights, and Microsoft requires the app to have the prerequisite Partner Center submission/age-rating setup before API-managed submissions.

A successful workflow proves the exact signed MSIX was uploaded and the submission commit was accepted. It does not claim certification or publication unless Microsoft's status response explicitly reaches those states. Store submission never grants device-write authority.
