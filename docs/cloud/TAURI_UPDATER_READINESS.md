# Tauri updater readiness

Tauri v2 updater verification is mandatory and cannot be disabled. BobFWTools therefore does not enable runtime update installation until a persistent updater signing key has been provisioned through an approved secret-entry path.

The infrastructure defines only the AWS Secrets Manager **container** `bobfwtools/tauri-updater-signing-key`, encrypted by the BobFWTools evidence KMS key. Terraform intentionally does not define a secret value. The private key must never be committed, printed, or placed in repository variables. The release role receives read-only access so a future signed-artifact build can retrieve it through GitHub OIDC.

`create-tauri-update-manifest.mjs` produces Tauri-compatible static update JSON from existing `.sig` files. It requires valid SemVer, known desktop target keys, HTTPS download URLs without embedded credentials, a non-empty signature file, and unique target entries. It never signs artifacts itself.

Runtime updater activation remains blocked until all of these are proven together: a durable Tauri public key embedded in the app, private-key secret value provisioned out-of-band, updater artifacts built with that private key, platform code-signing gates, CDN stable-channel publication, and a signed-manifest end-to-end test. Downgrades must remain disabled.
