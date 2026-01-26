/**
 * Policy Engine - Evaluates policy gates and enforces compliance
 * 
 * This module implements the policy system defined in policies.json
 * It evaluates gates, checks language rules, and enforces RBAC
 * 
 * PRINCIPLE: No bypass, no circumvention, no exploit guidance
 */

export interface PolicyGate {
  id: string;
  type: 'boolean' | 'checkbox_and_text' | 'typed_confirmation' | 'content_scan' | 'allowlist_sha256';
  required: boolean;
  message: string;
  checkbox_text?: string;
  typed_phrase?: string;
  warning?: string;
  denied_patterns?: string[];
}

export interface PolicyGateResult {
  gateId: string;
  passed: boolean;
  reason?: string;
  required?: boolean;
}

export interface PolicyContext {
  userId?: string;
  role?: 'creator' | 'tech' | 'admin';
  actionId?: string;
  workflowId?: string;
  deviceSerial?: string;
  requestContent?: string;
}

export interface OwnershipAttestation {
  checkboxConfirmed: boolean;
  typedPhrase?: string;
  proofOfPurchase?: {
    receipt?: string;
    invoice?: string;
    deviceLabelPhoto?: string;
    serialImei?: string;
  };
}

export interface DeviceAuthorization {
  androidAdbAuthorized?: boolean;
  iosPaired?: boolean;
  fastbootUnlocked?: boolean;
  bootloaderUnlocked?: boolean;
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  gates: PolicyGateResult[];
  blockedReason?: string;
  requiredGates?: string[];
}

export class PolicyEngine {
  private policies: any;
  private gates: Map<string, PolicyGate>;

  constructor() {
    this.gates = new Map();
    this.loadPolicies();
  }

  /**
   * Load policies from manifest file
   */
  private async loadPolicies() {
    try {
      // In production, this would load from runtime/manifests/policies-v2.json
      // For now, we'll use a simplified in-memory version
      this.policies = {
        gates: {
          ownership_attested: {
            id: 'ownership_attested',
            type: 'checkbox_and_text',
            required: true,
            message: 'Ownership/permission attestation is required.',
            checkbox_text: 'I own this device or have written permission to service it.',
            typed_phrase: 'I CONFIRM AUTHORIZED SERVICE'
          },
          device_authorized: {
            id: 'device_authorized',
            type: 'boolean',
            required: true,
            message: 'Device must be authorized (e.g., ADB RSA accepted / trusted pairing present / fastboot permitted).'
          },
          bootloader_unlocked: {
            id: 'bootloader_unlocked',
            type: 'boolean',
            required: false,
            message: 'Bootloader must be unlocked for flashing operations.'
          },
          destructive_confirm: {
            id: 'destructive_confirm',
            type: 'typed_confirmation',
            required: true,
            phrase: 'ERASE_AND_RESTORE',
            warning: 'This may erase data. Ensure backups are complete. Proceed only if you understand the impact.',
            message: 'Typed confirmation is required for destructive actions.'
          }
        },
        blocked_intent_keywords: [
          'bypass',
          'frp',
          'activation lock removal',
          'icloud unlock',
          'mdm bypass',
          'jailbreak for unlock',
          'remove google account',
          'unauthorized access',
          'bruteforce',
          'exploit'
        ]
      };

      // Initialize gates map
      Object.values(this.policies.gates).forEach((gate: any) => {
        this.gates.set(gate.id, gate);
      });
    } catch (error) {
      console.error('[PolicyEngine] Failed to load policies:', error);
      throw error;
    }
  }

  /**
   * Evaluate all policy gates for an operation
   */
  async evaluateGates(
    context: PolicyContext,
    attestation?: OwnershipAttestation,
    authorization?: DeviceAuthorization,
    destructiveConfirm?: string
  ): Promise<PolicyEvaluationResult> {
    const results: PolicyGateResult[] = [];

    // Check content for blocked keywords
    if (context.requestContent) {
      const contentCheck = this.checkBlockedKeywords(context.requestContent);
      if (!contentCheck.allowed) {
        return {
          allowed: false,
          gates: [contentCheck],
          blockedReason: contentCheck.reason,
          requiredGates: []
        };
      }
      results.push(contentCheck);
    }

    // Evaluate ownership attestation gate
    if (this.gates.has('ownership_attested')) {
      const gate = this.gates.get('ownership_attested')!;
      const result = this.evaluateOwnershipGate(gate, attestation);
      results.push(result);
      if (gate.required && !result.passed) {
        return {
          allowed: false,
          gates: results,
          blockedReason: result.reason,
          requiredGates: ['ownership_attested']
        };
      }
    }

    // Evaluate device authorization gate (if action requires it)
    if (this.gates.has('device_authorized') && this.requiresDeviceAuth(context.actionId)) {
      const gate = this.gates.get('device_authorized')!;
      const result = this.evaluateDeviceAuthGate(gate, authorization, context.actionId);
      results.push(result);
      if (gate.required && !result.passed) {
        return {
          allowed: false,
          gates: results,
          blockedReason: result.reason,
          requiredGates: ['device_authorized']
        };
      }
    }

    // Evaluate bootloader unlock gate (if action requires it)
    if (this.gates.has('bootloader_unlocked') && this.requiresBootloaderUnlock(context.actionId)) {
      const gate = this.gates.get('bootloader_unlocked')!;
      const result = this.evaluateBootloaderGate(gate, authorization);
      results.push(result);
      if (gate.required && !result.passed) {
        return {
          allowed: false,
          gates: results,
          blockedReason: result.reason,
          requiredGates: ['bootloader_unlocked']
        };
      }
    }

    // Evaluate destructive confirmation gate (if action is destructive)
    if (this.gates.has('destructive_confirm') && this.isDestructiveAction(context.actionId)) {
      const gate = this.gates.get('destructive_confirm')!;
      const result = this.evaluateDestructiveGate(gate, destructiveConfirm);
      results.push(result);
      if (gate.required && !result.passed) {
        return {
          allowed: false,
          gates: results,
          blockedReason: result.reason,
          requiredGates: ['destructive_confirm']
        };
      }
    }

    // All gates passed
    return {
      allowed: true,
      gates: results,
      requiredGates: results.filter(r => r.required).map(r => r.gateId)
    };
  }

  /**
   * Check for blocked keywords in content
   */
  private checkBlockedKeywords(content: string): PolicyGateResult {
    const keywords = this.policies.blocked_intent_keywords || [];
    const lowerContent = content.toLowerCase();

    for (const keyword of keywords) {
      if (lowerContent.includes(keyword.toLowerCase())) {
        return {
          gateId: 'no_circumvention',
          passed: false,
          reason: `This action is blocked because it resembles circumvention. Use official recovery pathways only. (Blocked keyword: "${keyword}")`,
          required: true
        };
      }
    }

    return {
      gateId: 'no_circumvention',
      passed: true,
      required: true
    };
  }

  /**
   * Evaluate ownership attestation gate
   */
  private evaluateOwnershipGate(gate: PolicyGate, attestation?: OwnershipAttestation): PolicyGateResult {
    if (!attestation) {
      return {
        gateId: gate.id,
        passed: false,
        reason: gate.message,
        required: gate.required
      };
    }

    if (!attestation.checkboxConfirmed) {
      return {
        gateId: gate.id,
        passed: false,
        reason: `Checkbox confirmation required: "${gate.checkbox_text}"`,
        required: gate.required
      };
    }

    if (gate.typed_phrase && attestation.typedPhrase !== gate.typed_phrase) {
      return {
        gateId: gate.id,
        passed: false,
        reason: `Typed phrase must match exactly: "${gate.typed_phrase}"`,
        required: gate.required
      };
    }

    return {
      gateId: gate.id,
      passed: true,
      required: gate.required
    };
  }

  /**
   * Evaluate device authorization gate
   */
  private evaluateDeviceAuthGate(
    gate: PolicyGate,
    authorization?: DeviceAuthorization,
    actionId?: string
  ): PolicyGateResult {
    if (!authorization) {
      return {
        gateId: gate.id,
        passed: false,
        reason: gate.message,
        required: gate.required
      };
    }

    // Check based on action type
    if (actionId?.startsWith('android.adb')) {
      if (!authorization.androidAdbAuthorized) {
        return {
          gateId: gate.id,
          passed: false,
          reason: 'ADB authorization required. Please accept RSA key on device.',
          required: gate.required
        };
      }
    } else if (actionId?.startsWith('ios.')) {
      if (!authorization.iosPaired) {
        return {
          gateId: gate.id,
          passed: false,
          reason: 'iOS pairing required. Please trust computer on device.',
          required: gate.required
        };
      }
    }

    return {
      gateId: gate.id,
      passed: true,
      required: gate.required
    };
  }

  /**
   * Evaluate bootloader unlock gate
   */
  private evaluateBootloaderGate(gate: PolicyGate, authorization?: DeviceAuthorization): PolicyGateResult {
    if (!authorization) {
      return {
        gateId: gate.id,
        passed: false,
        reason: gate.message,
        required: gate.required
      };
    }

    if (!authorization.bootloaderUnlocked) {
      return {
        gateId: gate.id,
        passed: false,
        reason: 'Bootloader must be unlocked. Use OEM-approved unlock methods.',
        required: gate.required
      };
    }

    return {
      gateId: gate.id,
      passed: true,
      required: gate.required
    };
  }

  /**
   * Evaluate destructive confirmation gate
   */
  private evaluateDestructiveGate(gate: PolicyGate, confirmPhrase?: string): PolicyGateResult {
    if (!confirmPhrase) {
      return {
        gateId: gate.id,
        passed: false,
        reason: gate.message,
        required: gate.required
      };
    }

    if (gate.typed_phrase && confirmPhrase !== gate.typed_phrase) {
      return {
        gateId: gate.id,
        passed: false,
        reason: `Typed phrase must match exactly: "${gate.typed_phrase}"`,
        required: gate.required
      };
    }

    return {
      gateId: gate.id,
      passed: true,
      required: gate.required
    };
  }

  /**
   * Check if action requires device authorization
   */
  private requiresDeviceAuth(actionId?: string): boolean {
    if (!actionId) return false;
    
    const requiresAuth = [
      'android.adb.getprop',
      'android.adb.bugreport',
      'android.adb.logcat',
      'ios.ideviceinfo.identity',
      'ios.irecovery.query'
    ];

    return requiresAuth.some(id => actionId.startsWith(id));
  }

  /**
   * Check if action requires bootloader unlock
   */
  private requiresBootloaderUnlock(actionId?: string): boolean {
    if (!actionId) return false;
    
    const requiresUnlock = [
      'android.fastboot.flash',
      'android.fastboot.erase'
    ];

    return requiresUnlock.some(id => actionId.startsWith(id));
  }

  /**
   * Check if action is destructive
   */
  private isDestructiveAction(actionId?: string): boolean {
    if (!actionId) return false;
    
    const destructiveActions = [
      'android.fastboot.flash',
      'android.fastboot.erase',
      'factory_reset',
      'device_restore'
    ];

    return destructiveActions.some(id => actionId.includes(id));
  }

  /**
   * Get required gates for an action
   */
  getRequiredGates(actionId: string): string[] {
    const required: string[] = ['ownership_attested'];

    if (this.requiresDeviceAuth(actionId)) {
      required.push('device_authorized');
    }

    if (this.requiresBootloaderUnlock(actionId)) {
      required.push('bootloader_unlocked');
    }

    if (this.isDestructiveAction(actionId)) {
      required.push('destructive_confirm');
    }

    return required;
  }

  /**
   * Validate language (check for banned terms)
   */
  validateLanguage(text: string): { valid: boolean; bannedTerm?: string } {
    const keywords = this.policies.blocked_intent_keywords || [];
    const lowerText = text.toLowerCase();

    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return {
          valid: false,
          bannedTerm: keyword
        };
      }
    }

    return { valid: true };
  }
}

// Singleton instance
let policyEngineInstance: PolicyEngine | null = null;

export function getPolicyEngine(): PolicyEngine {
  if (!policyEngineInstance) {
    policyEngineInstance = new PolicyEngine();
  }
  return policyEngineInstance;
}
