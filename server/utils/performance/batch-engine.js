/**
 * Universal Legend Status - Request Batching Engine
 * Batch multiple operations for efficiency
 * 
 * Features:
 * - Request batching
 * - Operation queuing
 * - Batch size limits
 * - Timeout handling
 */

class BatchEngine {
  constructor(options = {}) {
    this.batchSize = options.batchSize || 10;
    this.batchTimeout = options.batchTimeout || 100; // 100ms
    this.maxWaitTime = options.maxWaitTime || 1000; // 1 second max wait
    
    this.queue = [];
    this.processing = false;
    this.timer = null;
  }

  /**
   * Add operation to batch
   */
  async add(operation, ...args) {
    return new Promise((resolve, reject) => {
      const item = {
        operation,
        args,
        resolve,
        reject,
        timestamp: Date.now()
      };
      
      this.queue.push(item);
      
      // Start processing if queue is full
      if (this.queue.length >= this.batchSize) {
        this.processBatch();
      } else if (!this.timer) {
        // Start timeout timer
        this.timer = setTimeout(() => {
          this.processBatch();
        }, this.batchTimeout);
      }
    });
  }

  /**
   * Process batch
   */
  async processBatch() {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    
    this.processing = true;
    
    // Clear timer
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    
    // Get batch items
    const batch = this.queue.splice(0, this.batchSize);
    
    try {
      // Execute batch
      const results = await this.executeBatch(batch);
      
      // Resolve promises
      for (let i = 0; i < batch.length; i++) {
        batch[i].resolve(results[i]);
      }
    } catch (error) {
      // Reject all on error
      for (const item of batch) {
        item.reject(error);
      }
    } finally {
      this.processing = false;
      
      // Process remaining if any
      if (this.queue.length > 0) {
        if (this.queue.length >= this.batchSize) {
          this.processBatch();
        } else {
          this.timer = setTimeout(() => {
            this.processBatch();
          }, this.batchTimeout);
        }
      }
    }
  }

  /**
   * Execute batch of operations
   */
  async executeBatch(batch) {
    // Group by operation type
    const grouped = {};
    for (const item of batch) {
      if (!grouped[item.operation.name || 'default']) {
        grouped[item.operation.name || 'default'] = [];
      }
      grouped[item.operation.name || 'default'].push(item);
    }
    
    // Execute each group
    const results = [];
    for (const [groupName, groupItems] of Object.entries(grouped)) {
      try {
        // Execute operations in parallel
        const groupResults = await Promise.all(
          groupItems.map(item => item.operation(...item.args))
        );
        results.push(...groupResults);
      } catch (error) {
        // If one fails, all fail
        throw error;
      }
    }
    
    return results;
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      queueSize: this.queue.length,
      processing: this.processing,
      batchSize: this.batchSize,
      batchTimeout: this.batchTimeout
    };
  }

  /**
   * Clear queue
   */
  clear() {
    // Reject all pending
    for (const item of this.queue) {
      item.reject(new Error('Batch queue cleared'));
    }
    this.queue = [];
    
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

// Singleton instance
const batchEngine = new BatchEngine();

export default batchEngine;
