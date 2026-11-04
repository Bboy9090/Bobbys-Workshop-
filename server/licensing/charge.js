/**
 * Atomic diagnostic-credit charge.
 *
 * The client is any pg-compatible object with `query` and `release`, so the transaction
 * logic can be tested without a database. Two corrections from the earlier draft:
 *
 *   1. A failed ROLLBACK never hides the error that caused it. The original error is
 *      rethrown unchanged.
 *   2. If ROLLBACK fails, the connection's state is unknown. It is marked unusable so the
 *      pool destroys it instead of returning it to other requests.
 */

const CONNECTION_UNUSABLE = Symbol('connectionUnusable');
const MAX_COST = 1000;

export class InsufficientCreditsError extends Error {
  constructor() {
    super('insufficient credits');
    this.name = 'InsufficientCreditsError';
  }
}

export function connectionIsUnusable(error) {
  return Boolean(error && error[CONNECTION_UNUSABLE]);
}

function validateRequest(request) {
  const { userId, deviceSerial, clientIp, creditCost } = request ?? {};
  if (typeof userId !== 'string' || userId.length === 0) throw new TypeError('userId is required');
  if (typeof deviceSerial !== 'string' || deviceSerial.length === 0 || deviceSerial.length > 100) {
    throw new TypeError('deviceSerial must be 1 to 100 characters');
  }
  if (typeof clientIp !== 'string' || clientIp.length === 0 || clientIp.length > 45) {
    throw new TypeError('clientIp must be 1 to 45 characters');
  }
  if (!Number.isInteger(creditCost) || creditCost < 1 || creditCost > MAX_COST) {
    throw new TypeError(`creditCost must be an integer from 1 to ${MAX_COST}`);
  }
}

async function tryRollback(client) {
  try {
    await client.query('ROLLBACK');
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns true when the charge committed, false when balance is insufficient (nothing was
 * written). Throws on any other failure, with the original error object.
 */
export async function chargeDiagnostic(client, request) {
  validateRequest(request);
  const { userId, deviceSerial, clientIp, creditCost } = request;

  await client.query('BEGIN');
  try {
    const { rows } = await client.query(
      'SELECT available_credits FROM users WHERE user_id = $1 FOR UPDATE',
      [userId],
    );
    if (rows.length === 0) {
      throw new Error('user record not found');
    }
    if (rows[0].available_credits < creditCost) {
      throw new InsufficientCreditsError();
    }

    await client.query(
      'UPDATE users SET available_credits = available_credits - $1 WHERE user_id = $2',
      [creditCost, userId],
    );
    await client.query(
      'INSERT INTO credit_transactions (user_id, amount_changed, reference_reason) VALUES ($1, $2, $3)',
      [userId, -creditCost, `diagnostic run for device serial ${deviceSerial}`],
    );
    await client.query(
      "INSERT INTO service_audit_log (user_id, action_performed, target_device_serial, ip_address) VALUES ($1, 'RUN_DIAGNOSTIC', $2, $3)",
      [userId, deviceSerial, clientIp],
    );
    await client.query('COMMIT');
    return true;
  } catch (error) {
    const rolledBack = await tryRollback(client);
    if (!rolledBack) {
      error[CONNECTION_UNUSABLE] = true;
    }
    if (error instanceof InsufficientCreditsError && rolledBack) {
      return false;
    }
    throw error;
  }
}

/** Acquires a client from a pg-compatible pool and always releases it, discarding bad ones. */
export async function chargeDiagnosticFromPool(pool, request) {
  const client = await pool.connect();
  let releaseError;
  try {
    return await chargeDiagnostic(client, request);
  } catch (error) {
    releaseError = connectionIsUnusable(error) ? error : undefined;
    throw error;
  } finally {
    client.release(releaseError);
  }
}
