// Shadow Logger - Encrypted logging for sensitive operations
// Uses AES-256-GCM for encryption with immutable append-only logs

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

class ShadowLogger {
  constructor(options = {}) {
    this.logsDir = options.logsDir || path.join(process.cwd(), 'logs', 'shadow');
    this.publicLogsDir = options.publicLogsDir || path.join(process.cwd(), 'logs', 'public');
    this.retentionDays = options.retentionDays || 90;
    
    // Generate or load encryption key
    // In production, this should be loaded from secure storage
    this.encryptionKey = options.encryptionKey || this._generateKey();
    
    // Ensure log directories exist
    this._ensureDirectories();
  }

  _ensureDirectories() {
    if (!existsSync(this.logsDir)) {
      mkdirSync(this.logsDir, { recursive: true });
    }
    if (!existsSync(this.publicLogsDir)) {
      mkdirSync(this.publicLogsDir, { recursive: true });
    }
  }

  _generateKey() {
    // In production, load from secure storage
    const envKey = process.env.SHADOW_LOG_KEY;
    if (envKey) {
      return Buffer.from(envKey, 'hex');
    }
    // Generate a deterministic key for development (NOT secure for production)
    return crypto.scryptSync('dev-shadow-key', 'shadow-salt', KEY_LENGTH);
  }

  /**
   * Encrypt data using AES-256-GCM
   * @param {string} data - Plain text data to encrypt
   * @returns {string} - JSON string with iv, authTag, and encrypted data
   */
  encrypt(data) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv, {
      authTagLength: AUTH_TAG_LENGTH
    });
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return JSON.stringify({
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      data: encrypted
    });
  }

  /**
   * Decrypt data encrypted with AES-256-GCM
   * @param {string} encryptedJson - JSON string with iv, authTag, and encrypted data
   * @returns {string} - Decrypted plain text
   */
  decrypt(encryptedJson) {
    const { iv, authTag, data } = JSON.parse(encryptedJson);
    
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM, 
      this.encryptionKey, 
      Buffer.from(iv, 'hex'),
      { authTagLength: AUTH_TAG_LENGTH }
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Log sensitive operation to encrypted shadow log
   * @param {Object} entry - Log entry with operation details
   */
  async logShadow(entry) {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        ...entry
      };
      
      const encrypted = this.encrypt(JSON.stringify(logEntry));
      
      const date = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.logsDir, `shadow-${date}.log`);
      
      // Append to log file (immutable, append-only)
      await fs.appendFile(logFile, encrypted + '\n');
      
      return { success: true, encrypted: true };
    } catch (error) {
      console.error('Shadow log error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Log public operation (not encrypted)
   * @param {Object} entry - Log entry
   */
  async logPublic(entry) {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        ...entry
      };
      
      const date = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.publicLogsDir, `public-${date}.log`);
      
      await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n');
      
      return { success: true, encrypted: false };
    } catch (error) {
      console.error('Public log error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Read shadow logs for a specific date
   * @param {string} date - Date in YYYY-MM-DD format (optional, defaults to today)
   */
  async readShadowLogs(date) {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const logFile = path.join(this.logsDir, `shadow-${targetDate}.log`);
      
      if (!existsSync(logFile)) {
        return { success: false, error: 'Log file not found', entries: [] };
      }
      
      const content = await fs.readFile(logFile, 'utf8');
      const lines = content.trim().split('\n').filter(line => line);
      
      const entries = lines.map(line => {
        try {
          const decrypted = this.decrypt(line);
          return JSON.parse(decrypted);
        } catch (e) {
          return { error: 'Failed to decrypt entry' };
        }
      });
      
      return { success: true, entries };
    } catch (error) {
      console.error('Read shadow logs error:', error);
      return { success: false, error: error.message, entries: [] };
    }
  }

  /**
   * Get log statistics
   */
  async getLogStats() {
    try {
      const shadowFiles = existsSync(this.logsDir) 
        ? (await fs.readdir(this.logsDir)).filter(f => f.startsWith('shadow-'))
        : [];
      
      const publicFiles = existsSync(this.publicLogsDir)
        ? (await fs.readdir(this.publicLogsDir)).filter(f => f.startsWith('public-'))
        : [];
      
      return {
        success: true,
        stats: {
          shadowLogFiles: shadowFiles.length,
          publicLogFiles: publicFiles.length,
          retentionDays: this.retentionDays,
          encryptionAlgorithm: ENCRYPTION_ALGORITHM,
          logsDirectory: this.logsDir
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Clean up old log files based on retention policy
   */
  async cleanupOldLogs() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
      
      let deleted = 0;
      
      // Clean shadow logs
      if (existsSync(this.logsDir)) {
        const files = await fs.readdir(this.logsDir);
        for (const file of files) {
          const match = file.match(/shadow-(\d{4}-\d{2}-\d{2})\.log/);
          if (match) {
            const fileDate = new Date(match[1]);
            if (fileDate < cutoffDate) {
              await fs.unlink(path.join(this.logsDir, file));
              deleted++;
            }
          }
        }
      }
      
      // Clean public logs
      if (existsSync(this.publicLogsDir)) {
        const files = await fs.readdir(this.publicLogsDir);
        for (const file of files) {
          const match = file.match(/public-(\d{4}-\d{2}-\d{2})\.log/);
          if (match) {
            const fileDate = new Date(match[1]);
            if (fileDate < cutoffDate) {
              await fs.unlink(path.join(this.publicLogsDir, file));
              deleted++;
            }
          }
        }
      }
      
      return { 
        success: true, 
        message: `Cleaned up ${deleted} old log files`,
        deletedCount: deleted 
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export default ShadowLogger;
