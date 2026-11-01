# bbw-license-core

Offline license verification for BobFWTools. Ed25519 signatures; the desktop client holds
only public keys.

## Token format

`bbwlic1.<base64url(payload)>.<base64url(signature)>`

The signature covers the exact payload bytes. The payload must be canonical JSON: fields
in declaration order, no extra whitespace, no duplicate keys, features sorted and unique.
Any other encoding is rejected even if its signature is valid.

## Verification order

1. Format and token length.
2. Version (only `1` is supported).
3. Structural validation and canonical form.
4. Trusted key lookup (unknown and revoked keys are rejected).
5. Signature (`verify_strict`).
6. Product, edition, and non-grantable features (device-altering capabilities cannot be
   granted by a license).
7. Clock: future-dated issuance, rollback beyond tolerance, and expiry.

Claims are not acted on until step 5 passes.

## Clock handling

The caller supplies `now` and the newest timestamp it has ever accepted (`high_water`).
Rollback beyond 300 seconds fails closed. Offline clock checks are not tamper-proof: a user
who controls the machine clock can defeat them. The check is there to catch accidental or
casual rollback, not to resist a determined local attacker. The caller must persist
`max(now, high_water)` after each successful launch.

## Key rotation

The trust store is a versioned JSON file shipped with the application. Key states:

- `active`: signs new licenses and verifies existing ones.
- `retired`: verifies tokens it already signed until they expire.
- `revoked`: rejects all of its tokens. Use this on suspected compromise.

The client stores the newest trust-store version it has accepted and refuses older
versions (`require_not_rolled_back`), so an old store cannot reinstate a revoked key.

## Reconciliation

`reconcile` checks that every entitled feature is implemented by this build
(`FeatureRegistry`) and provisioned on the server for the license ID (`ServerInventory`).
A missing or unknown feature is an error, not a silent drop.

## Build boundaries

- The `issuer` feature contains server-side signing code. Desktop builds must not enable
  it. The signing key comes from a secret store, never from source.
- Licensing results describe software entitlements only. They never enable device-altering
  access. Hardware permissions are a separate gate and must not be read from a license.

## Enforcement status

Enforcement is **not enabled**. Enabling it also requires production key generation and
custody, desktop integration (a Tauri command, which lives in the protected integration
branch), and the release review.

## Tests

- `cargo test` (verifier and reconciliation, default features)
- `cargo test --features issuer` (adds issuance round-trips)
- `db/licensing/test/run.sh` (migration against a local PostgreSQL 16 server)
- `npx vitest run tests/licensing` (transaction and lookup logic)
