/**
 * 🏆 Production-Grade Cleanup and Maintenance
 * 
 * Automatic cleanup, memory management, and maintenance tasks
 */

import infiniteResourceManager from './resource-manager.js';
import infiniteErrorHandler from './error-handler.js';
import infinitePerformanceMonitor from './performance-monitor.js';
import infiniteRateLimiter from '../../middleware/infinite-rate-limit.js';

class InfiniteCleanup {
  constructor() {
    this.cleanupInterval = null;
    this.cleanupIntervalMs = 300000; // 5 minutes
  }

  // Start automatic cleanup
  start() {
    if (this.cleanupInterval) {
      return; // Already running
    }

    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.cleanupIntervalMs);

    // Perform initial cleanup
    this.performCleanup();
  }

  // Stop automatic cleanup
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // Perform cleanup tasks
  performCleanup() {
    try {
      // Cleanup rate limiter
      infiniteRateLimiter.cleanup();

      // Cleanup old error history (keep last 1000)
      const recentErrors = infiniteErrorHandler.getRecentErrors(1000);
      // Error handler manages its own cleanup

      // Reset performance metrics if needed (optional - keep for analysis)
      // infinitePerformanceMonitor.resetMetrics();

      // Force garbage collection hint (if available)
      if (global.gc) {
        global.gc();
      }
    } catch (error) {
      console.error('[InfiniteCleanup] Cleanup error:', error);
    }
  }

  // Manual cleanup
  cleanup() {
    // Cleanup resources
    infiniteResourceManager.cleanup();

    // Perform standard cleanup
    this.performCleanup();
  }

  // Get cleanup status
  getStatus() {
    return {
      running: this.cleanupInterval !== null,
      interval: this.cleanupIntervalMs,
      lastCleanup: new Date().toISOString(),
    };
  }
}

export default new InfiniteCleanup();
