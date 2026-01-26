/**
 * 🏆 Production-Grade Error Handling for Infinite Legendary Features
 * 
 * Comprehensive error handling, recovery, and logging
 */

class InfiniteErrorHandler {
  constructor() {
    this.errorStats = {
      total: 0,
      byType: {},
      byFeature: {},
      recent: [],
    };
    this.maxRecentErrors = 1000;
  }

  // Handle and log errors
  handleError(error, context = {}) {
    const errorInfo = this._analyzeError(error, context);
    
    // Log error
    this._logError(errorInfo);
    
    // Update stats
    this._updateStats(errorInfo);
    
    // Return user-friendly error
    return this._formatError(errorInfo);
  }

  _analyzeError(error, context) {
    const errorInfo = {
      id: `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      message: error.message || 'Unknown error',
      stack: error.stack,
      type: this._classifyError(error),
      feature: context.feature || 'unknown',
      operation: context.operation || 'unknown',
      recoverable: this._isRecoverable(error),
      retryable: this._isRetryable(error),
      context: {
        ...context,
        nodeVersion: process.version,
        platform: process.platform,
      },
    };

    // Add specific error details
    if (error.code) {
      errorInfo.code = error.code;
    }

    if (error.statusCode) {
      errorInfo.statusCode = error.statusCode;
    }

    return errorInfo;
  }

  _classifyError(error) {
    const message = (error.message || '').toLowerCase();
    
    if (message.includes('not found') || message.includes('missing')) {
      return 'not_found';
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'timeout';
    }
    if (message.includes('permission') || message.includes('unauthorized')) {
      return 'permission';
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return 'validation';
    }
    if (message.includes('memory') || message.includes('out of memory')) {
      return 'resource';
    }
    if (message.includes('network') || message.includes('connection')) {
      return 'network';
    }
    
    return 'unknown';
  }

  _isRecoverable(error) {
    const message = (error.message || '').toLowerCase();
    
    // Non-recoverable errors
    if (message.includes('not installed') || 
        message.includes('not available') ||
        message.includes('missing dependency')) {
      return false;
    }
    
    // Recoverable errors
    if (message.includes('timeout') ||
        message.includes('network') ||
        message.includes('temporary')) {
      return true;
    }
    
    return true; // Default to recoverable
  }

  _isRetryable(error) {
    const message = (error.message || '').toLowerCase();
    
    // Retryable errors
    if (message.includes('timeout') ||
        message.includes('network') ||
        message.includes('temporary') ||
        message.includes('rate limit')) {
      return true;
    }
    
    // Non-retryable errors
    if (message.includes('validation') ||
        message.includes('permission') ||
        message.includes('not found')) {
      return false;
    }
    
    return false; // Default to non-retryable
  }

  _logError(errorInfo) {
    // Add to recent errors
    this.errorStats.recent.push(errorInfo);
    if (this.errorStats.recent.length > this.maxRecentErrors) {
      this.errorStats.recent.shift();
    }

    // Log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[${errorInfo.feature}] ${errorInfo.type}:`, {
        message: errorInfo.message,
        operation: errorInfo.operation,
        recoverable: errorInfo.recoverable,
        retryable: errorInfo.retryable,
      });
    }
  }

  _updateStats(errorInfo) {
    this.errorStats.total++;
    
    // By type
    this.errorStats.byType[errorInfo.type] = 
      (this.errorStats.byType[errorInfo.type] || 0) + 1;
    
    // By feature
    this.errorStats.byFeature[errorInfo.feature] = 
      (this.errorStats.byFeature[errorInfo.feature] || 0) + 1;
  }

  _formatError(errorInfo) {
    // User-friendly error message
    const userMessages = {
      not_found: 'Resource not found',
      timeout: 'Operation timed out. Please try again.',
      permission: 'Permission denied',
      validation: 'Invalid input provided',
      resource: 'Insufficient resources available',
      network: 'Network error. Please check your connection.',
      unknown: 'An unexpected error occurred',
    };

    return {
      error: {
        id: errorInfo.id,
        code: errorInfo.code || `INFINITE_${errorInfo.type.toUpperCase()}`,
        message: userMessages[errorInfo.type] || errorInfo.message,
        type: errorInfo.type,
        recoverable: errorInfo.recoverable,
        retryable: errorInfo.retryable,
        timestamp: errorInfo.timestamp,
      },
      // Include details in development
      ...(process.env.NODE_ENV !== 'production' && {
        details: {
          originalMessage: errorInfo.message,
          feature: errorInfo.feature,
          operation: errorInfo.operation,
        },
      }),
    };
  }

  // Get error statistics
  getErrorStats() {
    return {
      total: this.errorStats.total,
      byType: { ...this.errorStats.byType },
      byFeature: { ...this.errorStats.byFeature },
      recentCount: this.errorStats.recent.length,
    };
  }

  // Get recent errors
  getRecentErrors(limit = 100) {
    return this.errorStats.recent.slice(-limit).reverse();
  }

  // Clear error history
  clearErrorHistory() {
    this.errorStats = {
      total: this.errorStats.total, // Keep total count
      byType: {},
      byFeature: {},
      recent: [],
    };
  }
}

export default new InfiniteErrorHandler();
