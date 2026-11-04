-- 0001_licensing_hardening.sql
-- Licensing and audit schema for BobFWTools. Requires PostgreSQL 14+.
--
-- Guarantees and their limits:
--   * Audit and credit ledgers are append-only for the application role (no UPDATE/DELETE/
--     TRUNCATE privilege, plus triggers that reject those statements for any role).
--   * Database owners and superusers can disable triggers or drop them. Append-only is an
--     enforced control, not a cryptographic guarantee. See db/licensing/RETENTION.md.
--   * IP addresses are personal data. They are cleared (not the row) by the retention role
--     once their retention date has passed.
--   * License keys are never stored in a reversible or unkeyed form. `license_key_lookup`
--     is HMAC-SHA-256(server_pepper, license_key), computed by the application.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bbw_app') THEN
    CREATE ROLE bbw_app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bbw_retention') THEN
    CREATE ROLE bbw_retention NOLOGIN;
  END IF;
END
$$;

CREATE TYPE audit_action_type AS ENUM (
  'USER_LOGIN', 'LICENSE_VERIFY', 'RUN_DIAGNOSTIC', 'CREDIT_REFUND'
);

CREATE TABLE users (
  user_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email              VARCHAR(255) NOT NULL UNIQUE,
  license_key_lookup CHAR(64) NOT NULL UNIQUE,
  available_credits  INT NOT NULL DEFAULT 0 CHECK (available_credits >= 0),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE service_audit_log (
  log_id               BIGSERIAL PRIMARY KEY,
  user_id              UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  action_performed     audit_action_type NOT NULL,
  target_device_serial VARCHAR(100),
  ip_address           VARCHAR(45),
  ip_retain_until      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '90 days'),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE credit_transactions (
  transaction_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  amount_changed   INT NOT NULL CHECK (amount_changed <> 0),
  reference_reason VARCHAR(255) NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only enforcement -----------------------------------------------------------------

CREATE FUNCTION bbw_reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'table % is append-only', TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END
$$;

-- The only permitted change to an audit row is clearing ip_address after its retention date.
-- Every other column must be unchanged.
CREATE FUNCTION bbw_audit_guard_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.ip_address IS NOT NULL
     AND NEW.ip_address IS NULL
     AND OLD.ip_retain_until <= now()
     AND (to_jsonb(NEW) - 'ip_address') = (to_jsonb(OLD) - 'ip_address')
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'service_audit_log rows are append-only'
    USING ERRCODE = 'insufficient_privilege';
END
$$;

CREATE TRIGGER service_audit_log_no_delete
  BEFORE DELETE ON service_audit_log
  FOR EACH ROW EXECUTE FUNCTION bbw_reject_mutation();
CREATE TRIGGER service_audit_log_guard_update
  BEFORE UPDATE ON service_audit_log
  FOR EACH ROW EXECUTE FUNCTION bbw_audit_guard_update();
CREATE TRIGGER service_audit_log_no_truncate
  BEFORE TRUNCATE ON service_audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION bbw_reject_mutation();

CREATE TRIGGER credit_transactions_no_update
  BEFORE UPDATE ON credit_transactions
  FOR EACH ROW EXECUTE FUNCTION bbw_reject_mutation();
CREATE TRIGGER credit_transactions_no_delete
  BEFORE DELETE ON credit_transactions
  FOR EACH ROW EXECUTE FUNCTION bbw_reject_mutation();
CREATE TRIGGER credit_transactions_no_truncate
  BEFORE TRUNCATE ON credit_transactions
  FOR EACH STATEMENT EXECUTE FUNCTION bbw_reject_mutation();

-- Privileges -------------------------------------------------------------------------------

REVOKE ALL ON users, service_audit_log, credit_transactions FROM PUBLIC;

GRANT SELECT, INSERT ON users TO bbw_app;
GRANT UPDATE (available_credits) ON users TO bbw_app;
GRANT SELECT, INSERT ON service_audit_log, credit_transactions TO bbw_app;
GRANT USAGE ON SEQUENCE service_audit_log_log_id_seq TO bbw_app;

-- Retention clears IP addresses only. Triggers still enforce the single-column rule above.
GRANT SELECT ON service_audit_log TO bbw_retention;
GRANT UPDATE (ip_address) ON service_audit_log TO bbw_retention;
