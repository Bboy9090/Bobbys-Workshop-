# Licensing data: retention, redaction, and deletion

Status: design for review. The migration in this directory enforces the mechanics; the
retention periods below are proposals that require legal and privacy sign-off before any
production data is written.

## What is stored

| Table | Personal data | Purpose |
|---|---|---|
| `users` | `email` | Account identity and support contact |
| `users` | `license_key_lookup` | Keyed digest of the license key. Not reversible without the server pepper |
| `service_audit_log` | `ip_address` | Accountability for service actions |
| `service_audit_log` | `target_device_serial` | Which hardware was diagnosed |
| `credit_transactions` | none directly | Financial ledger, linked to a user ID |

## Retention periods (proposed)

- **IP addresses:** 90 days from the audit row's creation, recorded in `ip_retain_until`.
  After that the `ip_address` column is cleared. The audit row itself is kept.
- **Audit rows and credit ledger:** kept for the period required by accounting and
  security review. The period is set by policy, not by this schema. Until it is decided,
  no deletion job exists for these tables.
- **User accounts:** see deletion below.

## Redaction (implemented)

Only the `bbw_retention` role may clear an IP address, and only when:

1. `ip_address` is currently non-null,
2. `ip_retain_until` is in the past, and
3. no other column changes in the same row.

Triggers enforce all three for every role, including the owner. A row that fails any
condition raises `insufficient_privilege`.

## Deletion requests (documented, not automated)

Audit rows and credit ledger entries reference `users.user_id` with `ON DELETE RESTRICT`,
so a user row cannot be deleted while history exists. A deletion request is handled by
**anonymizing the account**, not deleting it:

1. Replace `users.email` with a non-identifying placeholder.
2. Overwrite `users.license_key_lookup` with a random value so the old key can no longer
   be matched. Do not reuse a lookup value.
3. Clear remaining IP addresses for that user's audit rows through the retention role,
   even if their retention date has not passed. This requires a separate, approved
   exception, recorded in the audit trail.
4. Keep the pseudonymous `user_id` and the financial ledger, which accounting requires.

This anonymization step is not yet implemented as a SQL function and must go through
review before it is.

## What append-only does and does not guarantee

- The application role cannot modify or delete audit or ledger rows. Triggers reject those
  statements for every role.
- A database owner or superuser can disable triggers, drop them, or change privileges. The
  control therefore protects against application bugs and ordinary misuse. It does not
  stop a privileged administrator. Detecting that case needs external log shipping or
  hash-chaining, which is not implemented here.
- Redaction is a deliberate, narrow exception to append-only. It is the only path that
  changes an existing audit row.

## Backups

Backups retain data outside the live table. Clearing an IP address does not remove it from
existing backups. Backup retention must be no longer than the longest retention period
above, and the privacy notice must say so.
