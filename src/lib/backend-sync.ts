/**
 * Backend Sync - Keep frontend and backend in sync
 * 
 * Continuously monitors backend health and attempts to keep it running.
 * Never lets frontend and backend go out of sync.
 */

import { checkBackendHealth, type BackendHealthStatus } from './backend-health';
import { createLogger } from './debug-logger';

const logger = createLogger('BackendSync');

export interface BackendSyncConfig {
  checkInterval?: number; // How often to check health (default: 10000ms)
  restartAttempts?: number; // Max restart attempts before giving up (default: unlimited)
  onBackendAvailable?: () => void;
  onBackendUnavailable?: () => void;
  onBackendRestored?: () => void;
}

class BackendSyncManager {
  private checkInterval: number;
  private restartAttempts: number;
  private maxRestartAttempts: number;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastHealthStatus: BackendHealthStatus | null = null;
  private consecutiveFailures = 0;
  private onBackendAvailable?: () => void;
  private onBackendUnavailable?: () => void;
  private onBackendRestored?: () => void;

  constructor(config: BackendSyncConfig = {}) {
    this.checkInterval = config.checkInterval || 10000; // Check every 10 seconds
    this.maxRestartAttempts = config.restartAttempts || Infinity; // Never give up
    this.restartAttempts = 0;
    this.onBackendAvailable = config.onBackendAvailable;
    this.onBackendUnavailable = config.onBackendUnavailable;
    this.onBackendRestored = config.onBackendRestored;
  }

  start() {
    if (this.isRunning) {
      logger.warn('Backend sync already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting backend sync manager');
    
    // Check immediately
    this.checkHealth();
    
    // Then check at intervals
    this.intervalId = setInterval(() => {
      this.checkHealth();
    }, this.checkInterval);
  }

  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    logger.info('Stopping backend sync manager');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async checkHealth() {
    try {
      const health = await checkBackendHealth();
      const wasHealthy = this.lastHealthStatus?.isHealthy ?? false;
      const isHealthy = health.isHealthy;

      this.lastHealthStatus = health;

      if (isHealthy) {
        // Backend is healthy
        this.consecutiveFailures = 0;
        this.restartAttempts = 0; // Reset restart attempts on success

        if (!wasHealthy) {
          // Backend just came back online
          logger.info('Backend restored - frontend and backend are now in sync');
          this.onBackendRestored?.();
        } else {
          // Backend was already healthy, just confirm
          this.onBackendAvailable?.();
        }
      } else {
        // Backend is unhealthy
        this.consecutiveFailures++;
        
        if (wasHealthy) {
          // Backend just went offline
          logger.warn('Backend went offline - frontend and backend are out of sync');
          this.onBackendUnavailable?.();
        } else {
          // Backend was already offline
          logger.debug(`Backend still offline (${this.consecutiveFailures} consecutive failures)`);
        }

        // Attempt to restore backend (in web mode, this will just keep checking)
        // In Tauri mode, the backend should auto-restart
        // For web dev mode, the Vite plugin handles restart
      }
    } catch (error) {
      logger.error('Error checking backend health:', error);
      this.consecutiveFailures++;
    }
  }

  getLastHealthStatus(): BackendHealthStatus | null {
    return this.lastHealthStatus;
  }

  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }
}

// Singleton instance
let syncManager: BackendSyncManager | null = null;

export function startBackendSync(config?: BackendSyncConfig): BackendSyncManager {
  if (syncManager) {
    syncManager.stop();
  }
  
  syncManager = new BackendSyncManager(config);
  syncManager.start();
  
  return syncManager;
}

export function stopBackendSync() {
  if (syncManager) {
    syncManager.stop();
    syncManager = null;
  }
}

export function getBackendSyncManager(): BackendSyncManager | null {
  return syncManager;
}
