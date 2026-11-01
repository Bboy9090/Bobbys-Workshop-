\set ON_ERROR_STOP on
-- Migration tests for 0001_licensing_hardening.sql. Run by test/run.sh.

INSERT INTO users (user_id, email, license_key_lookup, available_credits)
VALUES ('00000000-0000-0000-0000-000000000001', 'tester@example.test', repeat('a', 64), 5);

INSERT INTO service_audit_log (user_id, action_performed, ip_address, ip_retain_until)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'USER_LOGIN', '203.0.113.5', now() + interval '1 day'),
  ('00000000-0000-0000-0000-000000000001', 'RUN_DIAGNOSTIC', '203.0.113.6', now() - interval '1 day');

INSERT INTO credit_transactions (user_id, amount_changed, reference_reason)
VALUES ('00000000-0000-0000-0000-000000000001', -1, 'fixture');

-- Runs a statement and requires it to fail with the given SQLSTATE.
CREATE FUNCTION pg_temp.expect_error(stmt text, expected text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE stmt;
  RAISE EXCEPTION 'expected SQLSTATE % but statement succeeded: %', expected, stmt;
EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE <> expected THEN
    RAISE EXCEPTION 'expected SQLSTATE % but got %: %', expected, SQLSTATE, SQLERRM;
  END IF;
END
$$;

\echo 'append-only: triggers reject mutation for the owner as well'
SELECT pg_temp.expect_error($q$UPDATE service_audit_log SET action_performed = 'LICENSE_VERIFY'$q$, '42501') \g /dev/null
SELECT pg_temp.expect_error($q$DELETE FROM service_audit_log$q$, '42501') \g /dev/null
SELECT pg_temp.expect_error($q$TRUNCATE service_audit_log$q$, '42501') \g /dev/null
SELECT pg_temp.expect_error($q$UPDATE credit_transactions SET amount_changed = -2$q$, '42501') \g /dev/null
SELECT pg_temp.expect_error($q$DELETE FROM credit_transactions$q$, '42501') \g /dev/null
SELECT pg_temp.expect_error($q$TRUNCATE credit_transactions$q$, '42501') \g /dev/null

\echo 'redaction: only expired IP addresses may be cleared, and nothing else may change'
SELECT pg_temp.expect_error($q$UPDATE service_audit_log SET ip_address = NULL WHERE ip_retain_until > now()$q$, '42501') \g /dev/null
SELECT pg_temp.expect_error($q$UPDATE service_audit_log SET ip_address = NULL, target_device_serial = 'x' WHERE ip_retain_until <= now()$q$, '42501') \g /dev/null

\echo 'application role: least privilege'
SET ROLE bbw_app;
SELECT pg_temp.expect_error($q$UPDATE service_audit_log SET ip_address = NULL$q$, '42501') \g /dev/null
SELECT pg_temp.expect_error($q$DELETE FROM service_audit_log$q$, '42501') \g /dev/null
SELECT pg_temp.expect_error($q$DELETE FROM credit_transactions$q$, '42501') \g /dev/null
SELECT pg_temp.expect_error($q$UPDATE users SET email = 'changed@example.test'$q$, '42501') \g /dev/null
SELECT pg_temp.expect_error($q$UPDATE users SET available_credits = -1 WHERE user_id = '00000000-0000-0000-0000-000000000001'$q$, '23514') \g /dev/null
INSERT INTO service_audit_log (user_id, action_performed, ip_address)
VALUES ('00000000-0000-0000-0000-000000000001', 'RUN_DIAGNOSTIC', '203.0.113.7');
UPDATE users SET available_credits = available_credits - 1
WHERE user_id = '00000000-0000-0000-0000-000000000001';
RESET ROLE;

\echo 'retention role: clears expired IPs only'
SET ROLE bbw_retention;
UPDATE service_audit_log SET ip_address = NULL WHERE ip_retain_until <= now();
RESET ROLE;


\echo 'constraints: credits never negative; zero-amount ledger entries rejected'
SELECT pg_temp.expect_error($q$INSERT INTO credit_transactions (user_id, amount_changed, reference_reason) VALUES ('00000000-0000-0000-0000-000000000001', 0, 'zero')$q$, '23514') \g /dev/null

\echo 'MIGRATION_TESTS_PASS'
