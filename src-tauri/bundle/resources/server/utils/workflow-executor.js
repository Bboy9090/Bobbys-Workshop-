/**
 * Workflow Executor - Execute workflows using actions.json registry
 * 
 * PRINCIPLE: All workflow steps use allowlisted actions with policy gates
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'url';
import { getAuditLogger } from './audit-logger.js';
import { mapActionToOperation, getOperationParams } from './action-operation-mapper.js';
import { executeOperation } from '../operations.js';
import { evaluateRequiredGates, checkForBannedKeywords } from './policy-gate-evaluator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MANIFESTS_DIR = path.join(__dirname, '../../runtime/manifests');
const ACTIONS_MANIFEST = path.join(MANIFESTS_DIR, 'actions.json');
const WORKFLOWS_MANIFEST = path.join(MANIFESTS_DIR, 'workflows-v2.json');
const POLICIES_MANIFEST = path.join(MANIFESTS_DIR, 'policies-v2.json');
const TOOLS_MANIFEST = path.join(MANIFESTS_DIR, 'tools-v2.json');

let actionsCache = null;
let workflowsCache = null;
let policiesCache = null;
let toolsCache = null;

/**
 * Load manifests (with caching)
 */
async function loadManifest(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`[WorkflowExecutor] Failed to load manifest ${filePath}:`, error);
    return null;
  }
}

async function getActions() {
  if (!actionsCache) {
    actionsCache = await loadManifest(ACTIONS_MANIFEST);
  }
  return actionsCache?.actions || [];
}

async function getWorkflows() {
  if (!workflowsCache) {
    workflowsCache = await loadManifest(WORKFLOWS_MANIFEST);
  }
  return workflowsCache?.workflows || [];
}

async function getPolicies() {
  if (!policiesCache) {
    policiesCache = await loadManifest(POLICIES_MANIFEST);
  }
  return policiesCache;
}

async function getTools() {
  if (!toolsCache) {
    toolsCache = await loadManifest(TOOLS_MANIFEST);
  }
  return toolsCache?.tools || [];
}

/**
 * Find workflow by ID
 */
async function findWorkflow(workflowId) {
  const workflows = await getWorkflows();
  return workflows.find(w => w.id === workflowId);
}

/**
 * Find action by ID
 */
async function findAction(actionId) {
  const actions = await getActions();
  return actions.find(a => a.id === actionId);
}

/**
 * Find tool by ID
 */
async function findTool(toolId) {
  const tools = await getTools();
  return tools.find(t => t.id === toolId);
}

/**
 * Execute a workflow step
 */
async function executeStep(step, context) {
  const { caseId, userId, jobId, parameters } = context;
  const auditLogger = getAuditLogger();

  // Get actions for this step
  const actionIds = step.actions?.map(a => a.id) || [];
  
  const results = [];
  
  for (const actionId of actionIds) {
    const action = await findAction(actionId);
    
    if (!action) {
      await auditLogger.logEvent({
        caseId,
        userId,
        workflowId: jobId,
        stepId: step.id,
        actionId,
        action: 'action_not_found',
        args: { actionId },
        policyGates: [{ gateId: 'action_registry', passed: false, reason: 'Action not found' }],
        exitCode: 1
      });
      
      results.push({
        actionId,
        success: false,
        error: 'Action not found in registry'
      });
      continue;
    }

    // Find tool for this action
    const tool = await findTool(action.tool);
    
    if (!tool) {
      await auditLogger.logEvent({
        caseId,
        userId,
        workflowId: jobId,
        stepId: step.id,
        actionId,
        action: action.action || actionId,
        args: { tool: action.tool },
        policyGates: [{ gateId: 'tool_allowlist', passed: false, reason: 'Tool not allowlisted' }],
        exitCode: 1
      });
      
      results.push({
        actionId,
        success: false,
        error: 'Tool not found in allowlist'
      });
      continue;
    }

    // Map action to operation
    const capabilityId = mapActionToOperation(actionId);
    
    if (!capabilityId) {
      // Action doesn't map to an operation (e.g., emit actions, UI-only actions)
      // Log as successful but skip operation execution
      await auditLogger.logEvent({
        caseId,
        userId,
        workflowId: jobId,
        stepId: step.id,
        actionId,
        action: action.action || actionId,
        args: { tool: action.tool, args: action.args, parameters },
        policyGates: [{ gateId: 'tool_allowlist', passed: true }],
        exitCode: 0
      });

      results.push({
        actionId,
        success: true,
        tool: action.tool,
        note: 'Action does not map to operation (UI-only or emit action)'
      });
      continue;
    }

    // Get operation parameters
    const operationParams = getOperationParams(actionId, action, context);
    
    try {
      // Execute the operation
      const operationResult = await executeOperation(capabilityId, operationParams);
      
      // Log successful execution
      await auditLogger.logEvent({
        caseId,
        userId,
        workflowId: jobId,
        stepId: step.id,
        actionId,
        action: action.action || actionId,
        args: { tool: action.tool, args: action.args, parameters: operationParams, capabilityId },
        stdout: JSON.stringify(operationResult),
        policyGates: [{ gateId: 'tool_allowlist', passed: true }],
        exitCode: operationResult.success ? 0 : 1
      });

      results.push({
        actionId,
        success: operationResult.success || false,
        tool: action.tool,
        capabilityId,
        result: operationResult
      });
    } catch (error) {
      // Log failed execution
      await auditLogger.logEvent({
        caseId,
        userId,
        workflowId: jobId,
        stepId: step.id,
        actionId,
        action: action.action || actionId,
        args: { tool: action.tool, args: action.args, parameters: operationParams, capabilityId },
        stderr: error.message,
        policyGates: [{ gateId: 'tool_allowlist', passed: true }],
        exitCode: 1
      });

      results.push({
        actionId,
        success: false,
        tool: action.tool,
        capabilityId,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Execute a workflow
 */
export async function executeWorkflow(workflowId, context) {
  const { caseId, userId, jobId, parameters } = context;
  const auditLogger = getAuditLogger();

  // Find workflow
  const workflow = await findWorkflow(workflowId);
  
  if (!workflow) {
    await auditLogger.logEvent({
      caseId,
      userId,
      workflowId: jobId,
      actionId: 'workflow.execute',
      action: 'workflow_not_found',
      args: { workflowId },
      policyGates: [{ gateId: 'workflow_registry', passed: false, reason: 'Workflow not found' }],
      exitCode: 1
    });
    
    return {
      success: false,
      error: 'Workflow not found'
    };
  }

  // Check required gates
  const policies = await getPolicies();
  const requiredGates = workflow.required_gates || [];
  
  // Check for banned keywords in workflow name/description (GATE_NO_CIRCUMVENTION)
  const workflowContent = `${workflow.name} ${workflow.description || ''}`;
  const keywordCheck = checkForBannedKeywords(workflowContent, policies);
  
  if (keywordCheck.found) {
    await auditLogger.logEvent({
      caseId,
      userId,
      workflowId: jobId,
      actionId: 'workflow.execute',
      action: 'workflow_blocked_by_policy',
      args: { workflowId, bannedKeywords: keywordCheck.keywords },
      policyGates: [{ 
        gateId: 'GATE_NO_CIRCUMVENTION', 
        passed: false, 
        reason: `Banned keywords found: ${keywordCheck.keywords.join(', ')}` 
      }],
      exitCode: 1
    });
    
    return {
      success: false,
      error: `Workflow blocked: Contains banned keywords (${keywordCheck.keywords.join(', ')})`,
      policyResult: {
        blocked: true,
        reason: 'Banned keywords detected',
        keywords: keywordCheck.keywords
      }
    };
  }
  
  // Evaluate required gates
  const gateEvaluation = await evaluateRequiredGates(requiredGates, policies, {
    parameters,
    ownershipAttestation: context.ownershipAttestation,
    deviceAuthorization: context.deviceAuthorization,
    destructiveConfirm: context.destructiveConfirm
  });
  
  if (!gateEvaluation.allPassed) {
    await auditLogger.logEvent({
      caseId,
      userId,
      workflowId: jobId,
      actionId: 'workflow.execute',
      action: 'workflow_blocked_by_policy',
      args: { workflowId, requiredGates, failedGates: gateEvaluation.failedGates.map(g => g.gateId) },
      policyGates: gateEvaluation.gates,
      exitCode: 1
    });
    
    return {
      success: false,
      error: gateEvaluation.blockedReason || 'Required policy gates not satisfied',
      policyResult: gateEvaluation
    };
  }
  
  // Log workflow start with gate evaluation results
  await auditLogger.logEvent({
    caseId,
    userId,
    workflowId: jobId,
    actionId: 'workflow.execute',
    action: 'workflow_execution_started',
    args: { workflowId, requiredGates },
    policyGates: gateEvaluation.gates,
    exitCode: 0
  });

  // Execute workflow steps
  const steps = workflow.steps || [];
  const stepResults = [];

  for (const step of steps) {
    const stepResult = await executeStep(step, context);
    stepResults.push({
      stepId: step.id,
      stepName: step.name,
      results: stepResult
    });
  }

  // Log workflow completion
  await auditLogger.logEvent({
    caseId,
    userId,
    workflowId: jobId,
    actionId: 'workflow.execute',
    action: 'workflow_execution_completed',
    args: { workflowId, stepsCompleted: stepResults.length },
    policyGates: [],
    exitCode: 0
  });

  return {
    success: true,
    workflowId,
    steps: stepResults
  };
}
