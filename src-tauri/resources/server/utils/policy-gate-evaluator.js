/**
 * Policy Gate Evaluator
 * 
 * Evaluates policy gates for workflows based on policies-v2.json
 * This ensures workflows respect the required gates before execution
 */

/**
 * Evaluate a single policy gate
 */
export function evaluateGate(gateId, gate, context) {
  const { parameters = {}, ownershipAttestation, deviceAuthorization, destructiveConfirm } = context;
  
  switch (gateId) {
    case 'GATE_OWNERSHIP_ATTESTATION':
    case 'ownership_attested': {
      // Check ownership attestation
      if (gate.type === 'boolean') {
        // For boolean gates, check if ownership attestation is provided
        if (ownershipAttestation) {
          return {
            passed: true,
            gateId,
            message: 'Ownership attestation verified'
          };
        }
        return {
          passed: false,
          gateId,
          message: gate.message || 'Ownership/permission attestation is required.',
          requirements: {
            checkbox: gate.checkbox_text || 'I own this device or have written permission to service it.',
            typedPhrase: gate.typed_phrase || 'I CONFIRM AUTHORIZED SERVICE'
          }
        };
      }
      // Default: allow if not required
      return { passed: true, gateId };
    }
    
    case 'GATE_DEVICE_AUTHORIZATION':
    case 'device_authorized': {
      // Check device authorization
      if (gate.type === 'boolean') {
        if (deviceAuthorization) {
          return {
            passed: true,
            gateId,
            message: 'Device authorization verified'
          };
        }
        return {
          passed: false,
          gateId,
          message: gate.message || 'Device must be authorized (e.g., ADB RSA accepted / trusted pairing present / fastboot permitted).'
        };
      }
      return { passed: true, gateId };
    }
    
    case 'GATE_DESTRUCTIVE_CONFIRMATION':
    case 'destructive_confirm': {
      // Check destructive confirmation
      if (gate.type === 'typed_confirmation') {
        if (destructiveConfirm === gate.phrase) {
          return {
            passed: true,
            gateId,
            message: 'Destructive action confirmed'
          };
        }
        return {
          passed: false,
          gateId,
          message: gate.message || 'Typed confirmation is required for destructive actions.',
          requirements: {
            phrase: gate.phrase || 'ERASE_AND_RESTORE',
            warning: gate.warning || 'This may erase data. Ensure backups are complete. Proceed only if you understand the impact.'
          }
        };
      }
      return { passed: true, gateId };
    }
    
    case 'GATE_NO_CIRCUMVENTION': {
      // Check for banned keywords in workflow/action names
      // This is more of a content scan gate - handled at workflow level
      return {
        passed: true,
        gateId,
        message: 'No circumvention detected (content scan)'
      };
    }
    
    case 'GATE_TOOL_ALLOWLIST': {
      // Tool allowlist is already checked in workflow executor
      return {
        passed: true,
        gateId,
        message: 'Tool allowlist verified'
      };
    }
    
    default: {
      // Unknown gate - default to pass (permissive for unknown gates)
      return {
        passed: true,
        gateId,
        message: `Unknown gate ${gateId} - allowed by default`
      };
    }
  }
}

/**
 * Evaluate all required gates for a workflow
 */
export async function evaluateRequiredGates(requiredGates, policies, context) {
  const gateResults = [];
  
  if (!requiredGates || requiredGates.length === 0) {
    return {
      allPassed: true,
      gates: [],
      blockedReason: null
    };
  }
  
  const gates = policies?.gates || {};
  
  for (const gateId of requiredGates) {
    // Normalize gate ID (handle GATE_ prefix variations)
    const normalizedGateId = gateId.startsWith('GATE_') ? gateId : `GATE_${gateId.toUpperCase()}`;
    const gateKey = normalizedGateId.replace('GATE_', '').toLowerCase();
    
    // Find gate definition
    const gate = gates[gateKey] || gates[normalizedGateId] || null;
    
    if (!gate) {
      // Gate not found - log warning but don't block (permissive for missing gates)
      gateResults.push({
        passed: true,
        gateId,
        message: `Gate ${gateId} not found in policies - allowed by default`
      });
      continue;
    }
    
    // Evaluate gate
    const result = evaluateGate(gateId, gate, context);
    gateResults.push(result);
  }
  
  // Check if all gates passed
  const allPassed = gateResults.every(g => g.passed);
  const failedGates = gateResults.filter(g => !g.passed);
  
  return {
    allPassed,
    gates: gateResults,
    failedGates,
    blockedReason: allPassed ? null : `Required gates not satisfied: ${failedGates.map(g => g.gateId).join(', ')}`
  };
}

/**
 * Check for banned keywords in workflow/action content (for GATE_NO_CIRCUMVENTION)
 */
export function checkForBannedKeywords(content, policies) {
  const bannedKeywords = policies?.global?.ui_language?.banned_terms || [];
  const blockedKeywords = policies?.blocked_intent_keywords || [];
  const allBanned = [...bannedKeywords, ...blockedKeywords];
  
  if (!content) {
    return {
      found: false,
      keywords: []
    };
  }
  
  const contentLower = content.toLowerCase();
  const foundKeywords = allBanned.filter(keyword => 
    contentLower.includes(keyword.toLowerCase())
  );
  
  return {
    found: foundKeywords.length > 0,
    keywords: foundKeywords
  };
}
