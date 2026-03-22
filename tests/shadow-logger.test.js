// Test for Shadow Logger with AES-256 encryption and tamper detection

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ShadowLogger from '../core/lib/shadow-logger.js';
import fs from 'fs';
import path from 'path';

const TEST_LOG_DIR = path.join(process.cwd(), '.test-shadow-logs');
const TEST_PUBLIC_DIR = path.join(process.cwd(), 'test-logs');

describe('ShadowLogger', () => {
  let logger;

  beforeEach(() => {
    logger = new ShadowLogger({
      encryptionKey: Buffer.from('test-key-32-bytes-long-exactly!!'),
      retentionDays: 1
    });
    
    // Override log directories for testing
    process.env.SHADOW_LOG_DIR = TEST_LOG_DIR;
    process.env.PUBLIC_LOG_DIR = TEST_PUBLIC_DIR;
  });

  afterEach(() => {
    // Cleanup test directories
    if (fs.existsSync(TEST_LOG_DIR)) {
      fs.rmSync(TEST_LOG_DIR, { recursive: true, force: true });
    }
    if (fs.existsSync(TEST_PUBLIC_DIR)) {
      fs.rmSync(TEST_PUBLIC_DIR, { recursive: true, force: true });
    }
  });

  describe('Encryption and Decryption', () => {
    it('should encrypt and decrypt data correctly', () => {
      const testData = {
        operation: 'test_operation',
        deviceSerial: 'TEST123',
        userId: 'testuser',
        authorization: 'GRANTED'
      };

      const encrypted = logger.encrypt(testData);
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('encrypted');
      expect(encrypted).toHaveProperty('authTag');

      const decrypted = logger.decrypt(encrypted);
      expect(decrypted).toEqual(testData);
    });

    it('should fail decryption with wrong auth tag', () => {
      const testData = { test: 'data' };
      const encrypted = logger.encrypt(testData);
      
      // Tamper with auth tag
      encrypted.authTag = 'invalid-auth-tag-00000000000000000000000000000000';
      
      expect(() => logger.decrypt(encrypted)).toThrow();
    });
  });

  describe('Hash Generation and Verification', () => {
    it('should generate consistent hashes', () => {
      const data = { test: 'data' };
      const hash1 = logger.generateHash(data);
      const hash2 = logger.generateHash(data);
      
      expect(hash1).toBe(hash2);
    });

    it('should detect hash tampering', () => {
      const data = { test: 'data' };
      const hash = logger.generateHash(data);
      
      expect(logger.verifyHash(data, hash)).toBe(true);
      
      const tamperedData = { test: 'modified' };
      expect(logger.verifyHash(tamperedData, hash)).toBe(false);
    });
  });

  describe('Shadow Logging', () => {
    it('should log sensitive operations', async () => {
      const logEntry = {
        operation: 'frp_bypass_test',
        deviceSerial: 'DEVICE123',
        userId: 'admin',
        authorization: 'CONFIRMED',
        success: true,
        metadata: { timestamp: new Date().toISOString() }
      };

      const result = await logger.logShadow(logEntry);
      expect(result.success).toBe(true);
    });

    it('should read and decrypt shadow logs', async () => {
      const logEntry = {
        operation: 'test_operation',
        deviceSerial: 'DEVICE456',
        userId: 'admin',
        authorization: 'GRANTED',
        success: true,
        metadata: {}
      };

      await logger.logShadow(logEntry);

      const date = new Date().toISOString().split('T')[0];
      const result = await logger.readShadowLogs(date);

      expect(result.success).toBe(true);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].operation).toBe('test_operation');
      expect(result.entries[0].tampered).toBe(false);
    });
  });

  describe('Public Logging', () => {
    it('should log public operations', async () => {
      const logEntry = {
        operation: 'workflow_start',
        message: 'Test workflow started',
        metadata: { workflowId: 'test-123' }
      };

      const result = await logger.logPublic(logEntry);
      expect(result.success).toBe(true);
    });
  });

  describe('Anonymization', () => {
    it('should anonymize sensitive data', () => {
      const sensitiveData = 'user@example.com';
      const anonymized = logger.anonymize(sensitiveData);
      
      expect(anonymized).not.toBe(sensitiveData);
      expect(anonymized).toHaveLength(16);
      expect(anonymized).toMatch(/^[A-F0-9]+$/);
    });

    it('should handle N/A values', () => {
      expect(logger.anonymize('N/A')).toBe('ANONYMOUS');
      expect(logger.anonymize(null)).toBe('ANONYMOUS');
      expect(logger.anonymize(undefined)).toBe('ANONYMOUS');
    });
  });

  describe('Statistics', () => {
    it('should return log statistics', async () => {
      await logger.logShadow({
        operation: 'test1',
        deviceSerial: 'D1',
        userId: 'u1',
        authorization: 'OK',
        success: true
      });

      await logger.logPublic({
        operation: 'test2',
        message: 'Public log'
      });

      const stats = await logger.getStats();
      expect(stats.success).toBe(true);
      expect(stats.stats).toHaveProperty('shadowLogs');
      expect(stats.stats).toHaveProperty('publicLogs');
    });
  });

  describe('Log Rotation', () => {
    it('should rotate old logs', async () => {
      const result = await logger.rotateLogs();
      expect(result.success).toBe(true);
    });
  });
});
