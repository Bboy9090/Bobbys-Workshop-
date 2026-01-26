/**
 * Retry and Circuit Breaker Utilities
 *
 * Provides robust retry logic and circuit breaker patterns for backend reliability
 */

import { createLogger } from './bundled-logger.js';

const logger = createLogger('RetryCircuit');

/**
 * Circuit breaker states
 */
const CIRCUIT_STATES = {
  CLOSED: 'closed',     // Normal operation
  OPEN: 'open',         // Circuit is open, failing fast
  HALF_OPEN: 'half_open' // Testing if service recovered
};

/**
 * Circuit breaker configuration
 */
const CIRCUIT_CONFIG = {
  failureThreshold: 5,      // Failures before opening circuit
  recoveryTimeout: 60000,   // Time to wait before trying again (1 minute)
  monitoringPeriod: 120000, // Period to monitor for failures (2 minutes)
  successThreshold: 3       // Successes needed to close circuit
};

/**
 * Circuit breaker instance
 */
class CircuitBreaker {
  constructor(name, config = {}) {
    this.name = name;
    this.config = { ...CIRCUIT_CONFIG, ...config };
    this.state = CIRCUIT_STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }

  async execute(operation, ...args) {
    if (this.state === CIRCUIT_STATES.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error(`Circuit breaker ${this.name} is OPEN - failing fast`);
      }
      // Transition to half-open
      this.state = CIRCUIT_STATES.HALF_OPEN;
      logger.info(`Circuit breaker ${this.name} transitioning to HALF_OPEN`);
    }

    try {
      const result = await operation(...args);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;

    if (this.state === CIRCUIT_STATES.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = CIRCUIT_STATES.CLOSED;
        this.successCount = 0;
        logger.info(`Circuit breaker ${this.name} CLOSED after ${this.config.successThreshold} successes`);
      }
    }
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CIRCUIT_STATES.HALF_OPEN) {
      // Go back to open if half-open fails
      this.state = CIRCUIT_STATES.OPEN;
      this.nextAttemptTime = Date.now() + this.config.recoveryTimeout;
      logger.error(`Circuit breaker ${this.name} failed in HALF_OPEN, returning to OPEN`);
    } else if (this.failureCount >= this.config.failureThreshold) {
      // Open the circuit
      this.state = CIRCUIT_STATES.OPEN;
      this.nextAttemptTime = Date.now() + this.config.recoveryTimeout;
      logger.error(`Circuit breaker ${this.name} OPEN after ${this.failureCount} failures`);
    }
  }

  getState() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime
    };
  }
}

// Global circuit breakers for critical operations
const circuitBreakers = {
  adb: new CircuitBreaker('adb', { failureThreshold: 3 }),
  fastboot: new CircuitBreaker('fastboot', { failureThreshold: 3 }),
  bootforgeusb: new CircuitBreaker('bootforgeusb', { failureThreshold: 5 }),
  ios_tools: new CircuitBreaker('ios_tools', { failureThreshold: 3 }),
  firmware_download: new CircuitBreaker('firmware_download', { failureThreshold: 3 })
};

/**
 * Get circuit breaker status for monitoring
 */
export function getCircuitBreakerStatus() {
  return Object.fromEntries(
    Object.entries(circuitBreakers).map(([name, breaker]) => [name, breaker.getState()])
  );
}

/**
 * Reset a circuit breaker (admin operation)
 */
export function resetCircuitBreaker(name) {
  if (circuitBreakers[name]) {
    circuitBreakers[name].state = CIRCUIT_STATES.CLOSED;
    circuitBreakers[name].failureCount = 0;
    circuitBreakers[name].successCount = 0;
    circuitBreakers[name].lastFailureTime = null;
    circuitBreakers[name].nextAttemptTime = null;
    logger.info(`Circuit breaker ${name} manually reset`);
    return true;
  }
  return false;
}

/**
 * Retry configuration
 */
const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelay: 1000,     // 1 second
  maxDelay: 10000,     // 10 seconds
  backoffMultiplier: 2,
  jitter: true
};

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt, config = RETRY_CONFIG) {
  const delay = Math.min(
    config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
    config.maxDelay
  );

  // Add jitter (±25%)
  const jitter = config.jitter ? delay * 0.25 * (Math.random() * 2 - 1) : 0;

  return Math.max(100, delay + jitter);
}

/**
 * Check if error is retryable
 */
function isRetryableError(error) {
  // Retry on network errors, timeouts, temporary failures
  const retryableMessages = [
    'timeout',
    'econnrefused',
    'enotfound',
    'econnreset',
    'etimedout',
    'device not found',
    'command failed',
    'spawn failed'
  ];

  const message = error.message?.toLowerCase() || '';
  return retryableMessages.some(pattern => message.includes(pattern));
}

/**
 * Execute operation with retry logic
 */
export async function withRetry(operation, options = {}, ...args) {
  const config = { ...RETRY_CONFIG, ...options };
  let lastError;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      logger.debug(`Retry attempt ${attempt}/${config.maxAttempts} for operation`);
      const result = await operation(...args);
      return result;
    } catch (error) {
      lastError = error;

      // Don't retry on non-retryable errors
      if (!isRetryableError(error)) {
        logger.debug(`Non-retryable error: ${error.message}`);
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === config.maxAttempts) {
        logger.error(`All ${config.maxAttempts} retry attempts failed`);
        break;
      }

      const delay = calculateDelay(attempt, config);
      logger.warn(`Attempt ${attempt} failed: ${error.message}. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Execute operation with circuit breaker and retry
 */
export async function withReliability(operation, circuitName, options = {}, ...args) {
  const circuitBreaker = circuitBreakers[circuitName];

  if (!circuitBreaker) {
    logger.warn(`No circuit breaker found for ${circuitName}, executing without protection`);
    return withRetry(operation, options, ...args);
  }

  return circuitBreaker.execute(
    () => withRetry(operation, options, ...args),
    ...args
  );
}

/**
 * Health check for circuit breakers
 */
export function getHealthStatus() {
  const breakers = getCircuitBreakerStatus();
  const unhealthy = Object.values(breakers).filter(b => b.state === CIRCUIT_STATES.OPEN);

  return {
    overall: unhealthy.length === 0 ? 'healthy' : 'degraded',
    circuitBreakers: breakers,
    unhealthyCount: unhealthy.length,
    timestamp: new Date().toISOString()
  };
}