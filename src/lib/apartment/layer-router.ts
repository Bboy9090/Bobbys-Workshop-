/**
 * APARTMENT LAYER ROUTER
 * 
 * Handles navigation between apartment layers.
 * Enforces access rules and maintains state machine.
 */

import { ApartmentLayer, isRoomAccessible, getRoom } from './room-types';

/**
 * Operator access levels
 */
export type OperatorLevel = 
  | 'visitor'     // No access beyond front room
  | 'surface'     // Front room only
  | 'operator'    // Back room access
  | 'trusted'     // Floor trap access
  | 'executing';  // Active operation

/**
 * Router state
 */
interface RouterState {
  currentLayer: ApartmentLayer;
  operatorLevel: OperatorLevel;
  sessionPasscode: string | null;
  deviceContext: DeviceContext | null;
  operationStack: string[];
  auditTrail: AuditEntry[];
}

/**
 * Device context for trapdoor access
 */
interface DeviceContext {
  serial: string;
  platform: 'android' | 'ios' | 'unknown';
  state: string;
  verified: boolean;
  connectedAt: number;
}

/**
 * Audit trail entry
 */
interface AuditEntry {
  timestamp: number;
  action: string;
  fromLayer: ApartmentLayer;
  toLayer: ApartmentLayer;
  operatorLevel: OperatorLevel;
  success: boolean;
  reason?: string;
}

/**
 * Navigation result
 */
interface NavigationResult {
  success: boolean;
  layer: ApartmentLayer;
  reason?: string;
  requiresAction?: 'passcode' | 'confirmation' | 'device' | 'verification';
}

/**
 * Layer Router singleton
 */
class ApartmentLayerRouter {
  private state: RouterState = {
    currentLayer: 'front-room',
    operatorLevel: 'surface',
    sessionPasscode: null,
    deviceContext: null,
    operationStack: [],
    auditTrail: [],
  };

  private listeners: Set<(state: RouterState) => void> = new Set();

  /**
   * Get current state
   */
  getState(): Readonly<RouterState> {
    return { ...this.state };
  }

  /**
   * Get current layer
   */
  getCurrentLayer(): ApartmentLayer {
    return this.state.currentLayer;
  }

  /**
   * Get operator level
   */
  getOperatorLevel(): OperatorLevel {
    return this.state.operatorLevel;
  }

  /**
   * Navigate to a layer
   */
  navigateTo(layer: ApartmentLayer): NavigationResult {
    const context = {
      hasPasscode: !!this.state.sessionPasscode,
      devicePresent: !!this.state.deviceContext,
      operatorVerified: this.state.operatorLevel !== 'visitor',
      localEnvironment: true, // Assume local for now
    };

    const accessible = isRoomAccessible(layer, context);
    const room = getRoom(layer);

    if (!accessible) {
      // Determine what's needed
      let requiresAction: NavigationResult['requiresAction'];
      
      if (room.accessMethod === 'passcode' && !context.hasPasscode) {
        requiresAction = 'passcode';
      } else if (room.accessMethod === 'confirmation') {
        requiresAction = 'confirmation';
      } else if (room.accessMethod === 'context' && !context.devicePresent) {
        requiresAction = 'device';
      } else if (room.accessMethod === 'context') {
        requiresAction = 'verification';
      }

      this.addAuditEntry('navigate', this.state.currentLayer, layer, false, 
        `Access denied: ${room.accessMethod} required`);

      return {
        success: false,
        layer: this.state.currentLayer,
        reason: `Cannot access ${room.name}: ${room.accessMethod} required`,
        requiresAction,
      };
    }

    // Update operator level based on destination
    const newLevel = this.getOperatorLevelForLayer(layer);
    
    this.addAuditEntry('navigate', this.state.currentLayer, layer, true);

    this.state = {
      ...this.state,
      currentLayer: layer,
      operatorLevel: newLevel,
    };

    this.notify();

    return {
      success: true,
      layer,
    };
  }

  /**
   * Set session passcode (unlocks back room)
   */
  setPasscode(passcode: string): boolean {
    if (!passcode) return false;

    this.state = {
      ...this.state,
      sessionPasscode: passcode,
      operatorLevel: 'operator',
    };

    this.addAuditEntry('passcode', this.state.currentLayer, this.state.currentLayer, true);
    this.notify();

    return true;
  }

  /**
   * Clear passcode (locks back room)
   */
  clearPasscode(): void {
    this.state = {
      ...this.state,
      sessionPasscode: null,
      operatorLevel: 'surface',
      currentLayer: 'front-room',
    };

    this.addAuditEntry('logout', this.state.currentLayer, 'front-room', true);
    this.notify();
  }

  /**
   * Set device context (enables floor trap)
   */
  setDeviceContext(device: DeviceContext): void {
    this.state = {
      ...this.state,
      deviceContext: device,
    };

    this.addAuditEntry('device-connect', this.state.currentLayer, this.state.currentLayer, true,
      `Device: ${device.serial}`);
    this.notify();
  }

  /**
   * Clear device context (disables floor trap)
   */
  clearDeviceContext(): void {
    // If in floor trap, warp back to operator level
    if (this.state.currentLayer === 'floor-trap') {
      this.state = {
        ...this.state,
        currentLayer: 'back-room',
        deviceContext: null,
        operatorLevel: 'operator',
      };
    } else {
      this.state = {
        ...this.state,
        deviceContext: null,
      };
    }

    this.addAuditEntry('device-disconnect', this.state.currentLayer, this.state.currentLayer, true);
    this.notify();
  }

  /**
   * Push operation onto stack (entering executing state)
   */
  pushOperation(operationId: string): void {
    this.state = {
      ...this.state,
      operationStack: [...this.state.operationStack, operationId],
      operatorLevel: 'executing',
    };

    this.addAuditEntry('operation-start', this.state.currentLayer, this.state.currentLayer, true,
      `Operation: ${operationId}`);
    this.notify();
  }

  /**
   * Pop operation from stack
   */
  popOperation(): string | undefined {
    const op = this.state.operationStack[this.state.operationStack.length - 1];
    
    this.state = {
      ...this.state,
      operationStack: this.state.operationStack.slice(0, -1),
      operatorLevel: this.state.operationStack.length <= 1 
        ? this.getOperatorLevelForLayer(this.state.currentLayer)
        : 'executing',
    };

    if (op) {
      this.addAuditEntry('operation-end', this.state.currentLayer, this.state.currentLayer, true,
        `Operation: ${op}`);
    }
    
    this.notify();
    return op;
  }

  /**
   * Emergency exit (ceiling hatch activation)
   */
  emergencyExit(): void {
    // Clear operation stack and return to safe state
    this.state = {
      ...this.state,
      currentLayer: 'front-room',
      operatorLevel: this.state.sessionPasscode ? 'operator' : 'surface',
      operationStack: [],
    };

    this.addAuditEntry('emergency-exit', this.state.currentLayer, 'front-room', true,
      'Ceiling hatch activated');
    this.notify();
  }

  /**
   * Get audit trail
   */
  getAuditTrail(): readonly AuditEntry[] {
    return this.state.auditTrail;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: RouterState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Check if floor trap is available
   */
  isFloorTrapAvailable(): boolean {
    return (
      !!this.state.sessionPasscode &&
      !!this.state.deviceContext &&
      this.state.deviceContext.verified
    );
  }

  /**
   * Get operator level for layer
   */
  private getOperatorLevelForLayer(layer: ApartmentLayer): OperatorLevel {
    switch (layer) {
      case 'front-room':
        return this.state.sessionPasscode ? 'operator' : 'surface';
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

  /**
   * Add audit entry
   */
  private addAuditEntry(
    action: string,
    fromLayer: ApartmentLayer,
    toLayer: ApartmentLayer,
    success: boolean,
    reason?: string
  ): void {
    this.state.auditTrail = [
      ...this.state.auditTrail,
      {
        timestamp: Date.now(),
        action,
        fromLayer,
        toLayer,
        operatorLevel: this.state.operatorLevel,
        success,
        reason,
      },
    ].slice(-100); // Keep last 100 entries
  }

  /**
   * Notify listeners
   */
  private notify(): void {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }
}

// Singleton export
export const layerRouter = new ApartmentLayerRouter();
