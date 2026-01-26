/**
 * TRAPDOOR RULE ENFORCEMENT
 * 
 * The Trapdoor Rule: Trapdoors are contextual, ephemeral, never bookmarked.
 * 
 * They appear ONLY when:
 *   ✓ Device state matches required conditions
 *   ✓ Operator is present and verified
 *   ✓ Local environment is confirmed
 * 
 * This is how you keep secrets secret without hiding code.
 */

/**
 * Device state requirements for trapdoor access
 */
export interface DeviceStateRequirement {
  platform?: 'android' | 'ios' | 'any';
  states?: string[];  // e.g., ['device', 'recovery', 'bootloader']
  minConnection?: number;  // Minimum connection time in ms
  verified?: boolean;
}

/**
 * Operator requirements for trapdoor access
 */
export interface OperatorRequirement {
  hasPasscode: boolean;
  sessionMinAge?: number;  // Minimum session age in ms
  recentActivity?: boolean;  // Activity in last N minutes
}

/**
 * Environment requirements for trapdoor access
 */
export interface EnvironmentRequirement {
  isLocal: boolean;  // Not remote/cloud
  networkIsolated?: boolean;  // No network during operation
  backendConnected?: boolean;  // Backend available
}

/**
 * Complete trapdoor visibility conditions
 */
export interface TrapdoorConditions {
  device: DeviceStateRequirement;
  operator: OperatorRequirement;
  environment: EnvironmentRequirement;
}

/**
 * Trapdoor definition
 */
export interface TrapdoorDefinition {
  id: string;
  name: string;
  description: string;
  conditions: TrapdoorConditions;
  capabilities: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  ttl: number;  // Time-to-live in ms (how long trapdoor stays open)
}

/**
 * Trapdoor session (ephemeral access)
 */
export interface TrapdoorSession {
  trapdoorId: string;
  deviceSerial: string;
  openedAt: number;
  expiresAt: number;
  operatorId: string;
  operations: string[];  // Operations performed
}

/**
 * Built-in trapdoor definitions
 */
export const TRAPDOOR_DEFINITIONS: TrapdoorDefinition[] = [
  {
    id: 'unlock-chamber',
    name: 'Unlock Chamber',
    description: 'Device unlocking operations',
    conditions: {
      device: {
        platform: 'android',
        states: ['device', 'recovery'],
        verified: true,
      },
      operator: {
        hasPasscode: true,
        sessionMinAge: 30000,  // 30 seconds
      },
      environment: {
        isLocal: true,
        backendConnected: true,
      },
    },
    capabilities: ['frp-bypass', 'bootloader-unlock', 'oem-unlock'],
    riskLevel: 'high',
    ttl: 10 * 60 * 1000,  // 10 minutes
  },
  {
    id: 'root-vault',
    name: 'Root Vault',
    description: 'Root access operations',
    conditions: {
      device: {
        platform: 'android',
        states: ['device'],
        minConnection: 5000,  // 5 seconds connected
        verified: true,
      },
      operator: {
        hasPasscode: true,
        sessionMinAge: 60000,  // 1 minute
        recentActivity: true,
      },
      environment: {
        isLocal: true,
        backendConnected: true,
      },
    },
    capabilities: ['magisk-install', 'su-grant', 'root-shell'],
    riskLevel: 'critical',
    ttl: 5 * 60 * 1000,  // 5 minutes
  },
  {
    id: 'bypass-laboratory',
    name: 'Bypass Laboratory',
    description: 'Security bypass research',
    conditions: {
      device: {
        platform: 'any',
        verified: true,
      },
      operator: {
        hasPasscode: true,
        sessionMinAge: 120000,  // 2 minutes
        recentActivity: true,
      },
      environment: {
        isLocal: true,
        networkIsolated: true,  // No network during bypass
      },
    },
    capabilities: ['frp-research', 'mdm-analysis', 'lock-bypass'],
    riskLevel: 'critical',
    ttl: 3 * 60 * 1000,  // 3 minutes
  },
  {
    id: 'jailbreak-sanctum',
    name: 'Jailbreak Sanctum',
    description: 'iOS jailbreak operations',
    conditions: {
      device: {
        platform: 'ios',
        states: ['normal', 'recovery', 'dfu'],
        verified: true,
      },
      operator: {
        hasPasscode: true,
        sessionMinAge: 60000,
      },
      environment: {
        isLocal: true,
        backendConnected: true,
      },
    },
    capabilities: ['checkra1n', 'palera1n', 'unc0ver', 'taurine'],
    riskLevel: 'high',
    ttl: 15 * 60 * 1000,  // 15 minutes
  },
  {
    id: 'shadow-archive',
    name: 'Shadow Archive',
    description: 'Sensitive data operations',
    conditions: {
      device: {
        platform: 'any',
        verified: true,
      },
      operator: {
        hasPasscode: true,
        sessionMinAge: 180000,  // 3 minutes
        recentActivity: true,
      },
      environment: {
        isLocal: true,
        networkIsolated: true,
      },
    },
    capabilities: ['audit-export', 'evidence-seal', 'secure-wipe'],
    riskLevel: 'critical',
    ttl: 2 * 60 * 1000,  // 2 minutes
  },
];

/**
 * Trapdoor Rule Enforcer
 */
class TrapdoorRuleEnforcer {
  private activeSessions: Map<string, TrapdoorSession> = new Map();
  private accessLog: Array<{
    timestamp: number;
    trapdoorId: string;
    deviceSerial: string;
    action: 'open' | 'close' | 'expire' | 'deny';
    reason?: string;
  }> = [];

  /**
   * Check if a trapdoor is visible given current context
   */
  isTrapdoorVisible(
    trapdoorId: string,
    context: {
      device: {
        serial: string;
        platform: 'android' | 'ios' | 'unknown';
        state: string;
        connectedAt: number;
        verified: boolean;
      } | null;
      operator: {
        hasPasscode: boolean;
        sessionStartedAt: number;
        lastActivityAt: number;
      };
      environment: {
        isLocal: boolean;
        networkAvailable: boolean;
        backendConnected: boolean;
      };
    }
  ): boolean {
    const definition = TRAPDOOR_DEFINITIONS.find(t => t.id === trapdoorId);
    if (!definition) return false;

    // Check device requirements
    if (definition.conditions.device.platform !== 'any') {
      if (!context.device) return false;
      if (context.device.platform !== definition.conditions.device.platform) return false;
    }

    if (definition.conditions.device.states) {
      if (!context.device) return false;
      if (!definition.conditions.device.states.includes(context.device.state)) return false;
    }

    if (definition.conditions.device.minConnection) {
      if (!context.device) return false;
      const connectedDuration = Date.now() - context.device.connectedAt;
      if (connectedDuration < definition.conditions.device.minConnection) return false;
    }

    if (definition.conditions.device.verified) {
      if (!context.device || !context.device.verified) return false;
    }

    // Check operator requirements
    if (definition.conditions.operator.hasPasscode) {
      if (!context.operator.hasPasscode) return false;
    }

    if (definition.conditions.operator.sessionMinAge) {
      const sessionAge = Date.now() - context.operator.sessionStartedAt;
      if (sessionAge < definition.conditions.operator.sessionMinAge) return false;
    }

    if (definition.conditions.operator.recentActivity) {
      const activityAge = Date.now() - context.operator.lastActivityAt;
      if (activityAge > 5 * 60 * 1000) return false;  // 5 minutes
    }

    // Check environment requirements
    if (definition.conditions.environment.isLocal) {
      if (!context.environment.isLocal) return false;
    }

    if (definition.conditions.environment.networkIsolated) {
      if (context.environment.networkAvailable) return false;
    }

    if (definition.conditions.environment.backendConnected) {
      if (!context.environment.backendConnected) return false;
    }

    return true;
  }

  /**
   * Get all visible trapdoors for current context
   */
  getVisibleTrapdoors(context: Parameters<typeof this.isTrapdoorVisible>[1]): TrapdoorDefinition[] {
    return TRAPDOOR_DEFINITIONS.filter(t => this.isTrapdoorVisible(t.id, context));
  }

  /**
   * Open a trapdoor session (ephemeral access)
   */
  openTrapdoor(
    trapdoorId: string,
    deviceSerial: string,
    operatorId: string,
    context: Parameters<typeof this.isTrapdoorVisible>[1]
  ): TrapdoorSession | null {
    // Validate visibility
    if (!this.isTrapdoorVisible(trapdoorId, context)) {
      this.logAccess(trapdoorId, deviceSerial, 'deny', 'Conditions not met');
      return null;
    }

    const definition = TRAPDOOR_DEFINITIONS.find(t => t.id === trapdoorId);
    if (!definition) {
      this.logAccess(trapdoorId, deviceSerial, 'deny', 'Unknown trapdoor');
      return null;
    }

    // Check if already open
    const existingKey = `${trapdoorId}:${deviceSerial}`;
    const existing = this.activeSessions.get(existingKey);
    if (existing && existing.expiresAt > Date.now()) {
      return existing;  // Return existing session
    }

    // Create new session
    const session: TrapdoorSession = {
      trapdoorId,
      deviceSerial,
      openedAt: Date.now(),
      expiresAt: Date.now() + definition.ttl,
      operatorId,
      operations: [],
    };

    this.activeSessions.set(existingKey, session);
    this.logAccess(trapdoorId, deviceSerial, 'open');

    return session;
  }

  /**
   * Close a trapdoor session
   */
  closeTrapdoor(trapdoorId: string, deviceSerial: string): void {
    const key = `${trapdoorId}:${deviceSerial}`;
    this.activeSessions.delete(key);
    this.logAccess(trapdoorId, deviceSerial, 'close');
  }

  /**
   * Check if a trapdoor session is active
   */
  isSessionActive(trapdoorId: string, deviceSerial: string): boolean {
    const key = `${trapdoorId}:${deviceSerial}`;
    const session = this.activeSessions.get(key);
    
    if (!session) return false;
    if (session.expiresAt < Date.now()) {
      this.activeSessions.delete(key);
      this.logAccess(trapdoorId, deviceSerial, 'expire');
      return false;
    }

    return true;
  }

  /**
   * Get active session
   */
  getSession(trapdoorId: string, deviceSerial: string): TrapdoorSession | null {
    if (!this.isSessionActive(trapdoorId, deviceSerial)) return null;
    
    const key = `${trapdoorId}:${deviceSerial}`;
    return this.activeSessions.get(key) || null;
  }

  /**
   * Record an operation in a session
   */
  recordOperation(trapdoorId: string, deviceSerial: string, operation: string): boolean {
    const session = this.getSession(trapdoorId, deviceSerial);
    if (!session) return false;

    session.operations.push(operation);
    return true;
  }

  /**
   * Clean expired sessions
   */
  cleanExpiredSessions(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, session] of this.activeSessions) {
      if (session.expiresAt < now) {
        this.activeSessions.delete(key);
        this.logAccess(session.trapdoorId, session.deviceSerial, 'expire');
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): TrapdoorSession[] {
    this.cleanExpiredSessions();
    return Array.from(this.activeSessions.values());
  }

  /**
   * BLOCKED: Direct URL/bookmark access is NOT allowed
   */
  validateNotBookmarked(url: string): void {
    const trapdoorPatterns = [
      '/trapdoor/',
      '/floor-trap/',
      '/secret/',
      '/vault/',
      '/bypass/',
      '/jailbreak/',
      '/shadow/',
    ];

    for (const pattern of trapdoorPatterns) {
      if (url.includes(pattern)) {
        throw new Error(
          'TRAPDOOR RULE VIOLATION: Direct URL access to trapdoors is not allowed. ' +
          'Trapdoors are contextual and ephemeral. Navigate through the proper layers.'
        );
      }
    }
  }

  /**
   * Get access log
   */
  getAccessLog(): readonly typeof this.accessLog {
    return this.accessLog;
  }

  /**
   * Log access attempt
   */
  private logAccess(
    trapdoorId: string,
    deviceSerial: string,
    action: 'open' | 'close' | 'expire' | 'deny',
    reason?: string
  ): void {
    this.accessLog.push({
      timestamp: Date.now(),
      trapdoorId,
      deviceSerial,
      action,
      reason,
    });

    // Keep last 200 entries
    if (this.accessLog.length > 200) {
      this.accessLog = this.accessLog.slice(-200);
    }
  }
}

// Singleton export
export const trapdoorRule = new TrapdoorRuleEnforcer();

/**
 * Hook to check trapdoor visibility in React components
 */
export function useTrapdoorVisibility(
  trapdoorId: string,
  context: Parameters<typeof trapdoorRule.isTrapdoorVisible>[1]
): boolean {
  return trapdoorRule.isTrapdoorVisible(trapdoorId, context);
}
