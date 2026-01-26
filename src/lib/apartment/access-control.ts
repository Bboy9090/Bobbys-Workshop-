/**
 * APARTMENT ACCESS CONTROL
 * 
 * Unified access control for all apartment layers.
 * Combines room access, Codex rules, and trapdoor rules.
 */

import { ApartmentLayer, isRoomAccessible, getRoom } from './room-types';
import { layerRouter, OperatorLevel } from './layer-router';
import { codexRule, ExecutionRequest } from './codex-rule';
import { trapdoorRule, TrapdoorSession } from './trapdoor-rule';

/**
 * Access check result
 */
export interface AccessCheckResult {
  allowed: boolean;
  layer: ApartmentLayer;
  operatorLevel: OperatorLevel;
  reason?: string;
  requiresAction?: 'passcode' | 'confirmation' | 'device' | 'verification';
  trapdoorSession?: TrapdoorSession;
}

/**
 * Full context for access decisions
 */
export interface AccessContext {
  // Operator state
  hasPasscode: boolean;
  sessionStartedAt: number;
  lastActivityAt: number;
  
  // Device state
  device: {
    serial: string;
    platform: 'android' | 'ios' | 'unknown';
    state: string;
    connectedAt: number;
    verified: boolean;
  } | null;
  
  // Environment state
  isLocal: boolean;
  networkAvailable: boolean;
  backendConnected: boolean;
}

/**
 * Apartment Access Controller
 */
class ApartmentAccessController {
  /**
   * Check if access to a layer is allowed
   */
  checkAccess(layer: ApartmentLayer, context: AccessContext): AccessCheckResult {
    const room = getRoom(layer);
    const routerState = layerRouter.getState();

    // Check basic room accessibility
    const roomAccessible = isRoomAccessible(layer, {
      hasPasscode: context.hasPasscode,
      devicePresent: !!context.device,
      operatorVerified: context.hasPasscode,
      localEnvironment: context.isLocal,
    });

    if (!roomAccessible) {
      let requiresAction: AccessCheckResult['requiresAction'];
      
      if (room.accessMethod === 'passcode' && !context.hasPasscode) {
        requiresAction = 'passcode';
      } else if (room.accessMethod === 'confirmation') {
        requiresAction = 'confirmation';
      } else if (room.accessMethod === 'context' && !context.device) {
        requiresAction = 'device';
      } else if (room.accessMethod === 'context') {
        requiresAction = 'verification';
      }

      return {
        allowed: false,
        layer: routerState.currentLayer,
        operatorLevel: routerState.operatorLevel,
        reason: `Access to ${room.name} requires ${room.accessMethod}`,
        requiresAction,
      };
    }

    // For floor trap, check trapdoor visibility
    if (layer === 'floor-trap') {
      const trapdoorContext = {
        device: context.device,
        operator: {
          hasPasscode: context.hasPasscode,
          sessionStartedAt: context.sessionStartedAt,
          lastActivityAt: context.lastActivityAt,
        },
        environment: {
          isLocal: context.isLocal,
          networkAvailable: context.networkAvailable,
          backendConnected: context.backendConnected,
        },
      };

      const visibleTrapdoors = trapdoorRule.getVisibleTrapdoors(trapdoorContext);
      
      if (visibleTrapdoors.length === 0) {
        return {
          allowed: false,
          layer: routerState.currentLayer,
          operatorLevel: routerState.operatorLevel,
          reason: 'No trapdoors visible with current context',
          requiresAction: 'device',
        };
      }
    }

    return {
      allowed: true,
      layer,
      operatorLevel: this.getOperatorLevelForLayer(layer, context),
    };
  }

  /**
   * Check if a specific capability is allowed in current context
   */
  checkCapability(
    capability: string,
    context: AccessContext
  ): { allowed: boolean; layer: ApartmentLayer; reason?: string } {
    // Find which layer provides this capability
    const layerWithCapability = this.findLayerForCapability(capability);
    
    if (!layerWithCapability) {
      return {
        allowed: false,
        layer: 'front-room',
        reason: `Unknown capability: ${capability}`,
      };
    }

    const accessCheck = this.checkAccess(layerWithCapability, context);
    
    return {
      allowed: accessCheck.allowed,
      layer: layerWithCapability,
      reason: accessCheck.reason,
    };
  }

  /**
   * Execute through proper channels (enforces Codex rule)
   */
  requestExecution(
    source: 'sonic' | 'ghost' | 'pandora',
    operation: string,
    parameters: Record<string, unknown>,
    context: AccessContext
  ): ExecutionRequest | null {
    // Codex can only hand off, never execute directly
    const observations = codexRule.observe(source, operation, parameters, 1);
    const classification = codexRule.classify(source, operation, 'execution-request', 1, []);
    const recommendation = codexRule.recommend(
      source,
      operation,
      `Execute ${operation}`,
      'front-room',
      'medium',
      'Codex analysis complete',
      []
    );

    // Determine target room based on operation risk
    let targetRoom: 'front-room' | 'closet' | 'floor-trap' = 'front-room';
    
    if (this.isFloorTrapOperation(operation)) {
      const trapAccess = this.checkAccess('floor-trap', context);
      if (!trapAccess.allowed) {
        return null;  // Can't hand off to floor trap without access
      }
      targetRoom = 'floor-trap';
    }

    return codexRule.handoff(
      source,
      operation,
      targetRoom,
      operation,
      parameters,
      [observations],
      [classification],
      [recommendation]
    );
  }

  /**
   * Consume an execution request (from execution layer)
   */
  consumeExecution(requestId: string): ExecutionRequest | null {
    return codexRule.consumeHandoff(requestId);
  }

  /**
   * Get pending execution requests
   */
  getPendingExecutions(): ExecutionRequest[] {
    return codexRule.getPendingHandoffs();
  }

  /**
   * Open trapdoor with full validation
   */
  openTrapdoor(
    trapdoorId: string,
    context: AccessContext,
    operatorId: string
  ): TrapdoorSession | null {
    if (!context.device) return null;

    const trapdoorContext = {
      device: context.device,
      operator: {
        hasPasscode: context.hasPasscode,
        sessionStartedAt: context.sessionStartedAt,
        lastActivityAt: context.lastActivityAt,
      },
      environment: {
        isLocal: context.isLocal,
        networkAvailable: context.networkAvailable,
        backendConnected: context.backendConnected,
      },
    };

    return trapdoorRule.openTrapdoor(
      trapdoorId,
      context.device.serial,
      operatorId,
      trapdoorContext
    );
  }

  /**
   * Close trapdoor
   */
  closeTrapdoor(trapdoorId: string, deviceSerial: string): void {
    trapdoorRule.closeTrapdoor(trapdoorId, deviceSerial);
  }

  /**
   * Helper: Find layer for capability
   */
  private findLayerForCapability(capability: string): ApartmentLayer | null {
    const allRooms = [
      getRoom('front-room'),
      getRoom('back-room'),
      getRoom('closet'),
      getRoom('floor-trap'),
    ];

    for (const room of allRooms) {
      if (room.capabilities.includes(capability)) {
        return room.id;
      }
    }

    return null;
  }

  /**
   * Helper: Check if operation requires floor trap
   */
  private isFloorTrapOperation(operation: string): boolean {
    const floorTrapOperations = [
      'root', 'bypass', 'jailbreak', 'unlock', 'frp',
      'mdm', 'shadow', 'wipe', 'flash-system',
    ];

    return floorTrapOperations.some(op => 
      operation.toLowerCase().includes(op)
    );
  }

  /**
   * Helper: Get operator level for layer
   */
  private getOperatorLevelForLayer(
    layer: ApartmentLayer,
    context: AccessContext
  ): OperatorLevel {
    switch (layer) {
      case 'front-room':
        return context.hasPasscode ? 'operator' : 'surface';
      case 'back-room':
        return 'operator';
      case 'closet':
        return 'operator';
      case 'floor-trap':
        return 'trusted';
      default:
        return 'surface';
    }
  }
}

// Singleton export
export const accessControl = new ApartmentAccessController();

/**
 * Mental Rulebook (exported for documentation)
 */
export const MENTAL_RULEBOOK = [
  'If it can\'t be justified in the Front Room, it belongs below.',
  'Codex observes. Phoenix executes.',
  'Trapdoors are earned, not navigated.',
  'The Basement is never seen, only felt.',
  'Warps preserve context, never break it.',
  'Professional up front. Quiet depth underneath.',
  'No automation without intent.',
  'Every action leaves a trace.',
];
