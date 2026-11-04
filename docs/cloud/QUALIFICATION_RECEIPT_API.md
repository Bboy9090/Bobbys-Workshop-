# Qualification receipt API

The receipt endpoint is IAM-authenticated and accepts evidence only. It never performs a device action and rejects any receipt that claims execution or device-write authority.

Accepted records bind the source commit, artifact digest and provenance digest, normalize the payload, and are written under `qualification-receipts/` in the KMS-encrypted Object-Locked evidence bucket.

The GitHub release role receives only `execute-api:Invoke` for this route; Lambda receives only logging, scoped S3 `PutObject`, and the evidence-key encryption permissions it needs.
