/**
 * PHOENIX CORE — Power Star Verification
 * 
 * Multi-factor verification system for high-privilege operations.
 * Implements a "Power Star" challenge that must be completed before
 * destructive or sensitive operations can execute.
 * 
 * Power Stars are earned by:
 * 1. Operator presence verification
 * 2. Device state confirmation  
 * 3. Contextual challenge completion
 * 4. Time-locked approval
 * 5. Audit trail commitment
 * 
 * @module core/lib/power-star
 */

import crypto from 'crypto';
import { evaluatePolicy, ROLES, RISK_LEVELS } from './policy-evaluator.js';

/**
 * Power Star states
 */
export const STAR_STATES = {
  PENDING: 'pending',
  CHALLENGED: 'challenged',
  VERIFIED: 'verified',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
};

/**
 * Challenge types for Power Star verification
 */
export const CHALLENGE_TYPES = {
  // Simple confirmation
  CONFIRM: 'confirm',
  
  // Device serial match
  DEVICE_SERIAL: 'device_serial',
  
  // Passcode entry
  PASSCODE: 'passcode',
  
  // Time-delayed approval
  TIME_LOCK: 'time_lock',
  
  // Second operator approval
  DUAL_OPERATOR: 'dual_operator',
  
  // Knowledge check (operation understanding)
  KNOWLEDGE: 'knowledge',
};

/**
 * Power Star - A verification token for sensitive operations
 */
class PowerStar {
  constructor({
    id,
    operation,
    operationSpec,
    context,
    challenges = [],
    expiresIn = 300000, // 5 minutes default
  }) {
    this.id = id || `star_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    this.operation = operation;
    this.operationSpec = operationSpec;
    this.context = context;
    this.challenges = challenges;
    this.completedChallenges = new Set();
    
    this.state = STAR_STATES.PENDING;
    this.createdAt = Date.now();
    this.expiresAt = Date.now() + expiresIn;
    this.verifiedAt = null;
    this.verifiedBy = null;
    
    this.auditTrail = [];
    this._logEvent('created', { operation, challenges: challenges.map(c => c.type) });
  }
  
  /**
   * Log event to audit trail
   */
  _logEvent(event, data = {}) {
    this.auditTrail.push({
      timestamp: Date.now(),
      event,
      data,
    });
  }
  
  /**
   * Check if Power Star has expired
   */
  isExpired() {
    return Date.now() > this.expiresAt;
  }
  
  /**
   * Check if Power Star is valid for use
   */
  isValid() {
    return this.state === STAR_STATES.VERIFIED && !this.isExpired();
  }
  
  /**
   * Get pending challenges
   */
  getPendingChallenges() {
    return this.challenges.filter(c => !this.completedChallenges.has(c.id));
  }
  
  /**
   * Complete a challenge
   */
  completeChallenge(challengeId, response, operator) {
    const challenge = this.challenges.find(c => c.id === challengeId);
    if (!challenge) {
      return { success: false, error: 'Challenge not found' };
    }
    
    if (this.completedChallenges.has(challengeId)) {
      return { success: false, error: 'Challenge already completed' };
    }
    
    // Verify challenge response
    const verified = this._verifyChallenge(challenge, response);
    if (!verified.success) {
      this._logEvent('challenge_failed', { challengeId, reason: verified.error });
      return verified;
    }
    
    this.completedChallenges.add(challengeId);
    this._logEvent('challenge_completed', { challengeId, operator });
    
    // Check if all challenges are complete
    if (this.completedChallenges.size === this.challenges.length) {
      this.state = STAR_STATES.VERIFIED;
      this.verifiedAt = Date.now();
      this.verifiedBy = operator;
      this._logEvent('verified', { operator });
    }
    
    return { 
      success: true, 
      remainingChallenges: this.getPendingChallenges().length,
      isVerified: this.state === STAR_STATES.VERIFIED,
    };
  }
  
  /**
   * Verify a challenge response
   */
  _verifyChallenge(challenge, response) {
    switch (challenge.type) {
      case CHALLENGE_TYPES.CONFIRM:
        return response === true
          ? { success: true }
          : { success: false, error: 'Confirmation required' };
        
      case CHALLENGE_TYPES.DEVICE_SERIAL:
        return response === challenge.expected
          ? { success: true }
          : { success: false, error: 'Device serial mismatch' };
        
      case CHALLENGE_TYPES.PASSCODE:
        // Hash comparison for passcode
        const hash = crypto.createHash('sha256').update(response).digest('hex');
        return hash === challenge.expectedHash
          ? { success: true }
          : { success: false, error: 'Invalid passcode' };
        
      case CHALLENGE_TYPES.TIME_LOCK:
        const elapsed = Date.now() - this.createdAt;
        return elapsed >= challenge.waitTime
          ? { success: true }
          : { success: false, error: `Wait ${Math.ceil((challenge.waitTime - elapsed) / 1000)} more seconds` };
        
      case CHALLENGE_TYPES.KNOWLEDGE:
        // Multiple choice or exact match
        if (Array.isArray(challenge.correctAnswers)) {
          return challenge.correctAnswers.includes(response)
            ? { success: true }
            : { success: false, error: 'Incorrect answer' };
        }
        return response === challenge.expected
          ? { success: true }
          : { success: false, error: 'Incorrect answer' };
        
      case CHALLENGE_TYPES.DUAL_OPERATOR:
        // Requires different operator than creator
        return response.operatorId !== this.context.operatorId
          ? { success: true }
          : { success: false, error: 'Second operator must be different from first' };
        
      default:
        return { success: false, error: `Unknown challenge type: ${challenge.type}` };
    }
  }
  
  /**
   * Revoke this Power Star
   */
  revoke(reason, revokedBy) {
    this.state = STAR_STATES.REVOKED;
    this._logEvent('revoked', { reason, revokedBy });
  }
  
  /**
   * Get status summary
   */
  getStatus() {
    return {
      id: this.id,
      operation: this.operation,
      state: this.state,
      isValid: this.isValid(),
      isExpired: this.isExpired(),
      challengesTotal: this.challenges.length,
      challengesCompleted: this.completedChallenges.size,
      pendingChallenges: this.getPendingChallenges().map(c => ({
        id: c.id,
        type: c.type,
        description: c.description,
      })),
      createdAt: this.createdAt,
      expiresAt: this.expiresAt,
      verifiedAt: this.verifiedAt,
      timeRemaining: Math.max(0, this.expiresAt - Date.now()),
    };
  }
  
  /**
   * Serialize for storage
   */
  toJSON() {
    return {
      id: this.id,
      operation: this.operation,
      operationSpec: this.operationSpec,
      context: this.context,
      challenges: this.challenges,
      completedChallenges: Array.from(this.completedChallenges),
      state: this.state,
      createdAt: this.createdAt,
      expiresAt: this.expiresAt,
      verifiedAt: this.verifiedAt,
      verifiedBy: this.verifiedBy,
      auditTrail: this.auditTrail,
    };
  }
}

/**
 * Power Star Manager - Creates and manages Power Stars
 */
class PowerStarManager {
  constructor() {
    this.stars = new Map();
    this.cleanupInterval = setInterval(() => this._cleanup(), 60000);
  }
  
  /**
   * Generate challenges for an operation
   */
  _generateChallenges(operation, operationSpec, context) {
    const challenges = [];
    const riskLevel = operationSpec.riskLevel || RISK_LEVELS.LOW;
    
    // All operations require confirmation
    challenges.push({
      id: `challenge_confirm_${Date.now()}`,
      type: CHALLENGE_TYPES.CONFIRM,
      description: `Confirm you want to execute: ${operation}`,
      order: 1,
    });
    
    // Device operations require serial verification
    if (context.device) {
      challenges.push({
        id: `challenge_device_${Date.now()}`,
        type: CHALLENGE_TYPES.DEVICE_SERIAL,
        description: 'Verify device serial number',
        expected: context.device.serial,
        displayHint: context.device.serial?.slice(-4) || '****',
        order: 2,
      });
    }
    
    // High risk operations require time lock
    if (riskLevel === RISK_LEVELS.HIGH) {
      challenges.push({
        id: `challenge_timelock_${Date.now()}`,
        type: CHALLENGE_TYPES.TIME_LOCK,
        description: 'Wait 10 seconds before proceeding',
        waitTime: 10000,
        order: 3,
      });
    }
    
    // Destructive operations require knowledge check
    if (riskLevel === RISK_LEVELS.DESTRUCTIVE) {
      challenges.push({
        id: `challenge_knowledge_${Date.now()}`,
        type: CHALLENGE_TYPES.KNOWLEDGE,
        description: 'What type of operation is this?',
        question: 'Select the correct description:',
        options: [
          'A safe, reversible operation',
          'A destructive operation that cannot be undone',
          'A diagnostic-only operation',
        ],
        correctAnswers: ['A destructive operation that cannot be undone'],
        order: 4,
      });
      
      // Also require longer time lock
      challenges.push({
        id: `challenge_timelock2_${Date.now()}`,
        type: CHALLENGE_TYPES.TIME_LOCK,
        description: 'Wait 30 seconds before proceeding (destructive operation)',
        waitTime: 30000,
        order: 5,
      });
    }
    
    // Sort by order
    challenges.sort((a, b) => a.order - b.order);
    
    return challenges;
  }
  
  /**
   * Request a Power Star for an operation
   */
  requestStar(operation, operationSpec, context) {
    // Check if operation requires Power Star
    const riskLevel = operationSpec.riskLevel || RISK_LEVELS.LOW;
    const requiresConfirmation = operationSpec.requiresConfirmation || false;
    
    if (riskLevel === RISK_LEVELS.LOW && !requiresConfirmation) {
      // No Power Star needed for low-risk operations
      return {
        required: false,
        reason: 'Low-risk operation, no verification required',
      };
    }
    
    // Check policy first
    const policy = evaluatePolicy(context.role || ROLES.VIEWER, operationSpec);
    if (!policy.allowed) {
      return {
        required: true,
        denied: true,
        reason: policy.reason,
      };
    }
    
    // Generate challenges
    const challenges = this._generateChallenges(operation, operationSpec, context);
    
    // Calculate expiration based on risk
    let expiresIn = 300000; // 5 minutes
    if (riskLevel === RISK_LEVELS.DESTRUCTIVE) {
      expiresIn = 120000; // 2 minutes for destructive
    } else if (riskLevel === RISK_LEVELS.HIGH) {
      expiresIn = 180000; // 3 minutes for high risk
    }
    
    // Create Power Star
    const star = new PowerStar({
      operation,
      operationSpec,
      context,
      challenges,
      expiresIn,
    });
    
    this.stars.set(star.id, star);
    
    return {
      required: true,
      star: star.getStatus(),
    };
  }
  
  /**
   * Get a Power Star by ID
   */
  getStar(starId) {
    const star = this.stars.get(starId);
    if (!star) return null;
    
    // Check expiration
    if (star.isExpired() && star.state !== STAR_STATES.EXPIRED) {
      star.state = STAR_STATES.EXPIRED;
      star._logEvent('expired');
    }
    
    return star;
  }
  
  /**
   * Complete a challenge for a Power Star
   */
  completeChallenge(starId, challengeId, response, operator) {
    const star = this.getStar(starId);
    if (!star) {
      return { success: false, error: 'Power Star not found' };
    }
    
    if (star.isExpired()) {
      return { success: false, error: 'Power Star has expired' };
    }
    
    if (star.state === STAR_STATES.REVOKED) {
      return { success: false, error: 'Power Star has been revoked' };
    }
    
    return star.completeChallenge(challengeId, response, operator);
  }
  
  /**
   * Verify a Power Star is valid for use
   */
  verifyStar(starId, operation, deviceSerial = null) {
    const star = this.getStar(starId);
    if (!star) {
      return { valid: false, error: 'Power Star not found' };
    }
    
    if (!star.isValid()) {
      return { 
        valid: false, 
        error: star.isExpired() ? 'Power Star has expired' : 'Power Star not verified',
        status: star.getStatus(),
      };
    }
    
    // Verify operation matches
    if (star.operation !== operation) {
      return { valid: false, error: 'Power Star is for a different operation' };
    }
    
    // Verify device matches (if applicable)
    if (deviceSerial && star.context.device?.serial !== deviceSerial) {
      return { valid: false, error: 'Power Star is for a different device' };
    }
    
    return { 
      valid: true, 
      star: star.getStatus(),
      auditTrail: star.auditTrail,
    };
  }
  
  /**
   * Revoke a Power Star
   */
  revokeStar(starId, reason, revokedBy) {
    const star = this.getStar(starId);
    if (!star) {
      return { success: false, error: 'Power Star not found' };
    }
    
    star.revoke(reason, revokedBy);
    return { success: true };
  }
  
  /**
   * Consume a Power Star (one-time use)
   */
  consumeStar(starId) {
    const star = this.getStar(starId);
    if (!star) {
      return { success: false, error: 'Power Star not found' };
    }
    
    if (!star.isValid()) {
      return { success: false, error: 'Power Star is not valid' };
    }
    
    // Mark as used and remove
    star._logEvent('consumed');
    star.state = STAR_STATES.EXPIRED;
    
    return { 
      success: true, 
      auditTrail: star.auditTrail,
    };
  }
  
  /**
   * Get all active Power Stars
   */
  getActiveStars() {
    const active = [];
    for (const star of this.stars.values()) {
      if (!star.isExpired() && star.state !== STAR_STATES.REVOKED) {
        active.push(star.getStatus());
      }
    }
    return active;
  }
  
  /**
   * Cleanup expired stars
   */
  _cleanup() {
    const now = Date.now();
    const cutoff = now - 3600000; // Remove stars older than 1 hour
    
    for (const [id, star] of this.stars) {
      if (star.createdAt < cutoff) {
        this.stars.delete(id);
      }
    }
  }
  
  /**
   * Get statistics
   */
  getStats() {
    let pending = 0, verified = 0, expired = 0, revoked = 0;
    
    for (const star of this.stars.values()) {
      switch (star.state) {
        case STAR_STATES.PENDING:
        case STAR_STATES.CHALLENGED:
          pending++;
          break;
        case STAR_STATES.VERIFIED:
          verified++;
          break;
        case STAR_STATES.EXPIRED:
          expired++;
          break;
        case STAR_STATES.REVOKED:
          revoked++;
          break;
      }
    }
    
    return { total: this.stars.size, pending, verified, expired, revoked };
  }
  
  /**
   * Shutdown
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Singleton instance
let managerInstance = null;

/**
 * Get the Power Star Manager singleton
 */
export function getPowerStarManager() {
  if (!managerInstance) {
    managerInstance = new PowerStarManager();
  }
  return managerInstance;
}

/**
 * Request a Power Star (convenience function)
 */
export function requestPowerStar(operation, operationSpec, context) {
  return getPowerStarManager().requestStar(operation, operationSpec, context);
}

/**
 * Verify a Power Star (convenience function)
 */
export function verifyPowerStar(starId, operation, deviceSerial) {
  return getPowerStarManager().verifyStar(starId, operation, deviceSerial);
}

export { PowerStar, PowerStarManager };
export default PowerStarManager;
