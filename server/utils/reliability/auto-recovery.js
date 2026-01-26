/**
 * Universal Legend Status - Auto-Recovery System
 * Self-healing mechanisms for system resilience
 * 
 * Features:
 * - Automatic error recovery
 * - Health monitoring
 * - Recovery strategies
 * - Failure detection
 */

import structuredLogger from '../observability/structured-logger.js';
import metricsCollector from '../observability/metrics-collector.js';

class AutoRecoveryManager {
  constructor() {
    this.recoveryStrategies = new Map();
    this.healthMonitors = new Map();
    this.recoveryHistory = [];
    this.maxHistory = 100;
  }

  /**
   * Register recovery strategy
   */
  registerStrategy(name, strategy) {
    this.recoveryStrategies.set(name, strategy);
  }

  /**
   * Register health monitor
   */
  registerHealthMonitor(name, monitor) {
    this.healthMonitors.set(name, monitor);
  }

  /**
   * Attempt recovery
   */
  async attemptRecovery(error, context = {}) {
    const errorType = this.classifyError(error);
    const strategy = this.recoveryStrategies.get(errorType);
    
    if (!strategy) {
      structuredLogger.warn('No recovery strategy found', {
        errorType,
        error: error.message
      });
      return { success: false, reason: 'No strategy found' };
    }

    try {
      structuredLogger.info('Attempting auto-recovery', {
        errorType,
        strategy: strategy.name,
        context
      });

      const result = await strategy.recover(error, context);
      
      if (result.success) {
        this.recordRecovery(errorType, strategy.name, true);
        metricsCollector.incrementCounter('recovery_attempts_total', {
          type: errorType,
          status: 'success'
        });
        
        structuredLogger.info('Auto-recovery successful', {
          errorType,
          strategy: strategy.name
        });
      } else {
        this.recordRecovery(errorType, strategy.name, false);
        metricsCollector.incrementCounter('recovery_attempts_total', {
          type: errorType,
          status: 'failed'
        });
        
        structuredLogger.warn('Auto-recovery failed', {
          errorType,
          strategy: strategy.name,
          reason: result.reason
        });
      }
      
      return result;
    } catch (recoveryError) {
      structuredLogger.error('Recovery strategy error', recoveryError, {
        errorType,
        strategy: strategy.name
      });
      
      return {
        success: false,
        reason: recoveryError.message
      };
    }
  }

  /**
   * Classify error type
   */
  classifyError(error) {
    const message = error.message?.toLowerCase() || '';
    
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'timeout';
    }
    if (message.includes('connection') || message.includes('econn')) {
      return 'connection';
    }
    if (message.includes('not found') || message.includes('enoent')) {
      return 'not_found';
    }
    if (message.includes('permission') || message.includes('eacces')) {
      return 'permission';
    }
    if (message.includes('device') || message.includes('adb')) {
      return 'device';
    }
    
    return 'unknown';
  }

  /**
   * Record recovery attempt
   */
  recordRecovery(errorType, strategy, success) {
    this.recoveryHistory.push({
      errorType,
      strategy,
      success,
      timestamp: Date.now()
    });
    
    // Keep only last N records
    if (this.recoveryHistory.length > this.maxHistory) {
      this.recoveryHistory.shift();
    }
  }

  /**
   * Get recovery statistics
   */
  getStats() {
    const total = this.recoveryHistory.length;
    const successful = this.recoveryHistory.filter(r => r.success).length;
    const failed = total - successful;
    
    const byType = {};
    for (const record of this.recoveryHistory) {
      if (!byType[record.errorType]) {
        byType[record.errorType] = { total: 0, successful: 0, failed: 0 };
      }
      byType[record.errorType].total++;
      if (record.success) {
        byType[record.errorType].successful++;
      } else {
        byType[record.errorType].failed++;
      }
    }
    
    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      byType
    };
  }
}

// Default recovery strategies
const defaultStrategies = {
  timeout: {
    name: 'retry_with_backoff',
    recover: async (error, context) => {
      // Retry with exponential backoff
      const maxRetries = 3;
      for (let i = 0; i < maxRetries; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        try {
          // Re-execute operation if available
          if (context.retry) {
            return { success: true, result: await context.retry() };
          }
        } catch (e) {
          if (i === maxRetries - 1) {
            return { success: false, reason: 'Max retries exceeded' };
          }
        }
      }
      return { success: false, reason: 'Retry failed' };
    }
  },
  
  connection: {
    name: 'reconnect',
    recover: async (error, context) => {
      // Attempt to reconnect
      if (context.reconnect) {
        try {
          await context.reconnect();
          return { success: true };
        } catch (e) {
          return { success: false, reason: e.message };
        }
      }
      return { success: false, reason: 'No reconnect function' };
    }
  },
  
  device: {
    name: 'rescan_devices',
    recover: async (error, context) => {
      // Rescan for devices
      if (context.rescan) {
        try {
          await context.rescan();
          return { success: true };
        } catch (e) {
          return { success: false, reason: e.message };
        }
      }
      return { success: false, reason: 'No rescan function' };
    }
  }
};

// Singleton instance
const autoRecovery = new AutoRecoveryManager();

// Register default strategies
for (const [type, strategy] of Object.entries(defaultStrategies)) {
  autoRecovery.registerStrategy(type, strategy);
}

export default autoRecovery;
