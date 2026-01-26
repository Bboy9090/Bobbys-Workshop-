/**
 * Universal Legend Status - Connection Pool Manager
 * Enterprise-grade connection pooling for efficient resource management
 * 
 * Features:
 * - Connection reuse
 * - Pool size limits
 * - Connection health checks
 * - Automatic cleanup
 */

class ConnectionPool {
  constructor(name, options = {}) {
    this.name = name;
    this.maxSize = options.maxSize || 10;
    this.minSize = options.minSize || 2;
    this.idleTimeout = options.idleTimeout || 30000; // 30 seconds
    this.maxLifetime = options.maxLifetime || 300000; // 5 minutes
    this.createConnectionFn = options.createConnection || null;
    this.isConnectionHealthyFn = options.isConnectionHealthy || null;
    
    this.pool = [];
    this.active = new Set();
    this.waiting = [];
    this.stats = {
      created: 0,
      acquired: 0,
      released: 0,
      destroyed: 0,
      errors: 0
    };
    
    // Cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanup(), 10000); // Every 10 seconds
  }

  /**
   * Create new connection
   */
  async createConnection() {
    if (!this.createConnectionFn) {
      throw new Error(`Connection pool "${this.name}" requires a createConnection function`);
    }

    const connection = await this.createConnectionFn();
    if (!connection) {
      throw new Error(`Connection pool "${this.name}" failed to create a connection`);
    }

    if (!connection.id) {
      connection.id = `${this.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    connection.createdAt = connection.createdAt || Date.now();
    connection.lastUsed = connection.lastUsed || Date.now();
    connection.state = connection.state || 'idle';
    connection.metadata = connection.metadata || {};

    this.stats.created++;
    return connection;
  }

  /**
   * Acquire connection from pool
   */
  async acquire() {
    // Try to get from pool
    let connection = this.pool.find(c => c.state === 'idle');
    
    if (!connection) {
      // Create new if under max size
      if (this.pool.length < this.maxSize) {
        connection = await this.createConnection();
        this.pool.push(connection);
      } else {
        // Wait for available connection
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            this.waiting = this.waiting.filter(w => w !== waiter);
            reject(new Error('Connection pool timeout'));
          }, 30000); // 30 second timeout
          
          const waiter = { resolve, reject, timeout };
          this.waiting.push(waiter);
        });
      }
    }
    
    // Mark as active
    connection.state = 'active';
    connection.lastUsed = Date.now();
    this.active.add(connection.id);
    this.stats.acquired++;
    
    return connection;
  }

  /**
   * Release connection back to pool
   */
  async release(connection) {
    if (!connection || !this.pool.includes(connection)) {
      return;
    }
    
    // Check if connection is still healthy
    if (this.isConnectionHealthy(connection)) {
      connection.state = 'idle';
      connection.lastUsed = Date.now();
      this.active.delete(connection.id);
      this.stats.released++;
      
      // Notify waiting requests
      if (this.waiting.length > 0) {
        const waiter = this.waiting.shift();
        clearTimeout(waiter.timeout);
        waiter.resolve(connection);
      }
    } else {
      // Connection unhealthy, destroy it
      await this.destroy(connection);
    }
  }

  /**
   * Check if connection is healthy
   */
  isConnectionHealthy(connection) {
    if (this.isConnectionHealthyFn) {
      try {
        return this.isConnectionHealthyFn(connection);
      } catch {
        this.stats.errors++;
        return false;
      }
    }

    const age = Date.now() - connection.createdAt;
    const idleTime = Date.now() - connection.lastUsed;
    
    // Check max lifetime
    if (age > this.maxLifetime) {
      return false;
    }
    
    // Check for errors
    if (connection.error) {
      return false;
    }
    
    return true;
  }

  /**
   * Destroy connection
   */
  async destroy(connection) {
    const index = this.pool.indexOf(connection);
    if (index !== -1) {
      this.pool.splice(index, 1);
      this.active.delete(connection.id);
      this.stats.destroyed++;
      
      // Cleanup connection resources
      if (connection.cleanup) {
        await connection.cleanup();
      }
    }
  }

  /**
   * Cleanup idle/expired connections
   */
  cleanup() {
    const now = Date.now();
    
    for (const connection of this.pool) {
      if (connection.state === 'idle') {
        const idleTime = now - connection.lastUsed;
        const age = now - connection.createdAt;
        
        // Remove if idle too long or too old
        if (idleTime > this.idleTimeout || age > this.maxLifetime) {
          this.destroy(connection);
        }
      }
    }
    
    // Ensure minimum pool size
    while (this.pool.length < this.minSize) {
      this.createConnection().then(conn => {
        this.pool.push(conn);
      });
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      name: this.name,
      poolSize: this.pool.length,
      active: this.active.size,
      idle: this.pool.filter(c => c.state === 'idle').length,
      waiting: this.waiting.length,
      maxSize: this.maxSize,
      minSize: this.minSize,
      stats: { ...this.stats }
    };
  }

  /**
   * Close pool
   */
  async close() {
    clearInterval(this.cleanupInterval);
    
    // Destroy all connections
    for (const connection of [...this.pool]) {
      await this.destroy(connection);
    }
    
    // Reject waiting requests
    for (const waiter of this.waiting) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error('Connection pool closed'));
    }
    this.waiting = [];
  }
}

/**
 * Connection Pool Manager
 */
class ConnectionPoolManager {
  constructor() {
    this.pools = new Map();
  }

  /**
   * Get or create pool
   */
  getPool(name, options = {}) {
    if (!this.pools.has(name)) {
      this.pools.set(name, new ConnectionPool(name, options));
    }
    return this.pools.get(name);
  }

  /**
   * Get all pool statistics
   */
  getAllStats() {
    const stats = {};
    for (const [name, pool] of this.pools.entries()) {
      stats[name] = pool.getStats();
    }
    return stats;
  }

  /**
   * Close all pools
   */
  async closeAll() {
    for (const pool of this.pools.values()) {
      await pool.close();
    }
    this.pools.clear();
  }
}

// Singleton instance
const poolManager = new ConnectionPoolManager();

export default poolManager;
