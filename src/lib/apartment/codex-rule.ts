/**
 * CODEX RULE ENFORCEMENT
 * 
 * The Codex Rule: Codex rooms NEVER execute blindly.
 * 
 * They ONLY:
 *   ○ OBSERVE   — Watch device/system state
 *   ○ CLASSIFY  — Categorize what they see
 *   ○ RECOMMEND — Suggest actions
 *   ○ HAND OFF  — Pass to execution layer
 * 
 * Execution ALWAYS happens through:
 *   → Phoenix Forge (Front Room)
 *   → Phoenix Key (Closet)
 *   → Explicit local confirmation (Floor Trap)
 */

/**
 * Codex action types - the ONLY things a Codex can do
 */
export type CodexAction = 
  | 'observe'     // Watch device/system state
  | 'classify'    // Categorize observations
  | 'recommend'   // Suggest actions
  | 'handoff';    // Pass to execution layer

/**
 * Codex observation result
 */
export interface CodexObservation {
  codex: 'sonic' | 'ghost' | 'pandora';
  action: 'observe';
  timestamp: number;
  subject: string;
  data: Record<string, unknown>;
  confidence: number;
}

/**
 * Codex classification result
 */
export interface CodexClassification {
  codex: 'sonic' | 'ghost' | 'pandora';
  action: 'classify';
  timestamp: number;
  subject: string;
  category: string;
  subcategory?: string;
  confidence: number;
  evidence: string[];
}

/**
 * Codex recommendation
 */
export interface CodexRecommendation {
  codex: 'sonic' | 'ghost' | 'pandora';
  action: 'recommend';
  timestamp: number;
  subject: string;
  recommendation: string;
  targetRoom: 'front-room' | 'closet' | 'floor-trap';
  priority: 'low' | 'medium' | 'high' | 'critical';
  reasoning: string;
  prerequisites: string[];
}

/**
 * Codex handoff request
 */
export interface CodexHandoff {
  codex: 'sonic' | 'ghost' | 'pandora';
  action: 'handoff';
  timestamp: number;
  subject: string;
  targetRoom: 'front-room' | 'closet' | 'floor-trap';
  operation: string;
  parameters: Record<string, unknown>;
  observations: CodexObservation[];
  classifications: CodexClassification[];
  recommendations: CodexRecommendation[];
}

/**
 * Execution request (what gets passed OUT of Codex)
 */
export interface ExecutionRequest {
  id: string;
  source: 'sonic' | 'ghost' | 'pandora';
  target: 'front-room' | 'closet' | 'floor-trap';
  operation: string;
  parameters: Record<string, unknown>;
  handoff: CodexHandoff;
  requiresConfirmation: boolean;
  createdAt: number;
  expiresAt: number;
}

/**
 * Codex Rule Enforcer
 */
class CodexRuleEnforcer {
  private pendingHandoffs: Map<string, ExecutionRequest> = new Map();
  private actionLog: Array<{
    timestamp: number;
    codex: string;
    action: CodexAction;
    subject: string;
  }> = [];

  /**
   * Validate that an action is allowed for Codex
   */
  isActionAllowed(action: string): action is CodexAction {
    return ['observe', 'classify', 'recommend', 'handoff'].includes(action);
  }

  /**
   * Log a Codex action
   */
  logAction(codex: 'sonic' | 'ghost' | 'pandora', action: CodexAction, subject: string): void {
    this.actionLog.push({
      timestamp: Date.now(),
      codex,
      action,
      subject,
    });

    // Keep last 500 entries
    if (this.actionLog.length > 500) {
      this.actionLog = this.actionLog.slice(-500);
    }
  }

  /**
   * Create an observation (allowed)
   */
  observe(
    codex: 'sonic' | 'ghost' | 'pandora',
    subject: string,
    data: Record<string, unknown>,
    confidence: number
  ): CodexObservation {
    this.logAction(codex, 'observe', subject);

    return {
      codex,
      action: 'observe',
      timestamp: Date.now(),
      subject,
      data,
      confidence: Math.max(0, Math.min(1, confidence)),
    };
  }

  /**
   * Create a classification (allowed)
   */
  classify(
    codex: 'sonic' | 'ghost' | 'pandora',
    subject: string,
    category: string,
    confidence: number,
    evidence: string[],
    subcategory?: string
  ): CodexClassification {
    this.logAction(codex, 'classify', subject);

    return {
      codex,
      action: 'classify',
      timestamp: Date.now(),
      subject,
      category,
      subcategory,
      confidence: Math.max(0, Math.min(1, confidence)),
      evidence,
    };
  }

  /**
   * Create a recommendation (allowed)
   */
  recommend(
    codex: 'sonic' | 'ghost' | 'pandora',
    subject: string,
    recommendation: string,
    targetRoom: 'front-room' | 'closet' | 'floor-trap',
    priority: 'low' | 'medium' | 'high' | 'critical',
    reasoning: string,
    prerequisites: string[] = []
  ): CodexRecommendation {
    this.logAction(codex, 'recommend', subject);

    return {
      codex,
      action: 'recommend',
      timestamp: Date.now(),
      subject,
      recommendation,
      targetRoom,
      priority,
      reasoning,
      prerequisites,
    };
  }

  /**
   * Create a handoff to execution layer (allowed)
   */
  handoff(
    codex: 'sonic' | 'ghost' | 'pandora',
    subject: string,
    targetRoom: 'front-room' | 'closet' | 'floor-trap',
    operation: string,
    parameters: Record<string, unknown>,
    observations: CodexObservation[],
    classifications: CodexClassification[],
    recommendations: CodexRecommendation[]
  ): ExecutionRequest {
    this.logAction(codex, 'handoff', subject);

    const handoff: CodexHandoff = {
      codex,
      action: 'handoff',
      timestamp: Date.now(),
      subject,
      targetRoom,
      operation,
      parameters,
      observations,
      classifications,
      recommendations,
    };

    const request: ExecutionRequest = {
      id: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      source: codex,
      target: targetRoom,
      operation,
      parameters,
      handoff,
      requiresConfirmation: true, // Always require confirmation
      createdAt: Date.now(),
      expiresAt: Date.now() + (5 * 60 * 1000), // 5 minute expiry
    };

    this.pendingHandoffs.set(request.id, request);

    return request;
  }

  /**
   * BLOCKED: Direct execution is NOT allowed from Codex
   */
  execute(): never {
    throw new Error(
      'CODEX RULE VIOLATION: Codex rooms cannot execute directly. ' +
      'Use handoff() to pass execution to Front Room, Closet, or Floor Trap.'
    );
  }

  /**
   * Get pending handoffs
   */
  getPendingHandoffs(): ExecutionRequest[] {
    const now = Date.now();
    
    // Clean expired handoffs
    for (const [id, request] of this.pendingHandoffs) {
      if (request.expiresAt < now) {
        this.pendingHandoffs.delete(id);
      }
    }

    return Array.from(this.pendingHandoffs.values());
  }

  /**
   * Consume a handoff (called by execution layer)
   */
  consumeHandoff(requestId: string): ExecutionRequest | null {
    const request = this.pendingHandoffs.get(requestId);
    
    if (!request) return null;
    if (request.expiresAt < Date.now()) {
      this.pendingHandoffs.delete(requestId);
      return null;
    }

    this.pendingHandoffs.delete(requestId);
    return request;
  }

  /**
   * Get action log
   */
  getActionLog(): readonly typeof this.actionLog {
    return this.actionLog;
  }

  /**
   * Validate Codex compliance
   */
  validateCompliance(codex: 'sonic' | 'ghost' | 'pandora', action: string): void {
    if (!this.isActionAllowed(action)) {
      throw new Error(
        `CODEX RULE VIOLATION: Action '${action}' is not allowed. ` +
        `Codex ${codex} can only: observe, classify, recommend, handoff.`
      );
    }
  }
}

// Singleton export
export const codexRule = new CodexRuleEnforcer();

/**
 * Decorator for Codex methods to enforce rules
 */
export function codexOnly(
  _target: unknown,
  propertyKey: string,
  descriptor: PropertyDescriptor
): PropertyDescriptor {
  const originalMethod = descriptor.value;

  descriptor.value = function (...args: unknown[]) {
    // Validate the action is Codex-safe
    if (!codexRule.isActionAllowed(propertyKey)) {
      throw new Error(
        `CODEX RULE VIOLATION: Method '${propertyKey}' is not a valid Codex action.`
      );
    }
    return originalMethod.apply(this, args);
  };

  return descriptor;
}
