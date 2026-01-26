/**
 * 🌟 World Class Universal Legend - Comprehensive Audit Trail
 * 
 * Enterprise-grade audit trail with:
 * - Immutable logs
 * - User action tracking
 * - Resource access logging
 * - Compliance reporting
 * - Search and filtering
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AuditTrail {
  constructor() {
    this.auditDir = path.join(__dirname, '../../audit-logs');
    this.maxFileSize = 10 * 1024 * 1024; // 10MB per file
    this.currentFile = null;
    this.currentFileSize = 0;
    this.initialize();
  }

  async initialize() {
    // Create audit directory
    await fs.mkdir(this.auditDir, { recursive: true });
    
    // Initialize current file
    await this._rotateFile();
    
    console.log('✅ Audit Trail system initialized');
  }

  async _rotateFile() {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `audit-${timestamp}-${Date.now()}.jsonl`;
    this.currentFile = path.join(this.auditDir, filename);
    this.currentFileSize = 0;
  }

  async _checkAndRotate() {
    if (this.currentFileSize >= this.maxFileSize) {
      await this._rotateFile();
    }
  }

  // Log audit event
  async log(event) {
    const auditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...event,
      hash: null, // Will be set after serialization
    };

    // Calculate hash for integrity
    const entryString = JSON.stringify(auditEntry);
    auditEntry.hash = crypto.createHash('sha256').update(entryString).digest('hex');

    // Write to file
    const finalEntry = { ...auditEntry };
    delete finalEntry.hash; // Remove hash from entry before calculating final hash
    const finalString = JSON.stringify(finalEntry);
    const finalHash = crypto.createHash('sha256').update(finalString).digest('hex');
    
    const entryWithHash = {
      ...finalEntry,
      integrityHash: finalHash,
    };

    await this._checkAndRotate();
    
    await fs.appendFile(
      this.currentFile,
      JSON.stringify(entryWithHash) + '\n',
      'utf-8'
    );

    this.currentFileSize += Buffer.byteLength(JSON.stringify(entryWithHash) + '\n');

    return auditEntry.id;
  }

  // Log user action
  async logUserAction(userId, action, details = {}) {
    return this.log({
      type: 'user_action',
      userId,
      action,
      details,
      severity: details.severity || 'info',
    });
  }

  // Log resource access
  async logResourceAccess(userId, resource, action, result) {
    return this.log({
      type: 'resource_access',
      userId,
      resource,
      action,
      result, // 'allowed' or 'denied'
      timestamp: new Date().toISOString(),
      severity: result === 'denied' ? 'warning' : 'info',
    });
  }

  // Log authentication event
  async logAuthentication(userId, event, details = {}) {
    return this.log({
      type: 'authentication',
      userId,
      event, // 'login', 'logout', 'mfa_verified', 'mfa_failed', etc.
      details,
      severity: event.includes('failed') ? 'warning' : 'info',
    });
  }

  // Log security event
  async logSecurityEvent(event, details = {}) {
    return this.log({
      type: 'security',
      event,
      details,
      severity: 'high',
    });
  }

  // Log data modification
  async logDataModification(userId, resource, action, before, after) {
    return this.log({
      type: 'data_modification',
      userId,
      resource,
      action, // 'create', 'update', 'delete'
      before,
      after,
      severity: 'medium',
    });
  }

  // Search audit logs
  async search(query) {
    const files = await fs.readdir(this.auditDir);
    const results = [];

    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;

      const filePath = path.join(this.auditDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          
          // Simple search - can be enhanced with full-text search
          if (this._matchesQuery(entry, query)) {
            results.push(entry);
          }
        } catch (error) {
          console.warn(`Failed to parse audit entry: ${error.message}`);
        }
      }
    }

    // Sort by timestamp descending
    results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return results;
  }

  _matchesQuery(entry, query) {
    if (!query) return true;

    const searchString = JSON.stringify(entry).toLowerCase();
    const queryString = query.toLowerCase();

    return searchString.includes(queryString);
  }

  // Get audit logs for user
  async getUserAuditLogs(userId, limit = 100) {
    const results = await this.search(`"userId":"${userId}"`);
    return results.slice(0, limit);
  }

  // Get audit logs for resource
  async getResourceAuditLogs(resource, limit = 100) {
    const results = await this.search(`"resource":"${resource}"`);
    return results.slice(0, limit);
  }

  // Generate compliance report
  async generateComplianceReport(startDate, endDate) {
    const allLogs = await this.search();
    const filtered = allLogs.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate >= new Date(startDate) && logDate <= new Date(endDate);
    });

    const report = {
      period: {
        start: startDate,
        end: endDate,
      },
      totalEvents: filtered.length,
      byType: {},
      byUser: {},
      bySeverity: {},
      securityEvents: filtered.filter(e => e.type === 'security'),
      failedAuthentications: filtered.filter(e => 
        e.type === 'authentication' && e.event.includes('failed')
      ),
      deniedAccess: filtered.filter(e => 
        e.type === 'resource_access' && e.result === 'denied'
      ),
    };

    // Aggregate by type
    for (const log of filtered) {
      report.byType[log.type] = (report.byType[log.type] || 0) + 1;
      if (log.userId) {
        report.byUser[log.userId] = (report.byUser[log.userId] || 0) + 1;
      }
      if (log.severity) {
        report.bySeverity[log.severity] = (report.bySeverity[log.severity] || 0) + 1;
      }
    }

    return report;
  }

  // Verify audit log integrity
  async verifyIntegrity(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    const issues = [];

    for (let i = 0; i < lines.length; i++) {
      try {
        const entry = JSON.parse(lines[i]);
        const { integrityHash, ...entryWithoutHash } = entry;
        const calculatedHash = crypto
          .createHash('sha256')
          .update(JSON.stringify(entryWithoutHash))
          .digest('hex');

        if (calculatedHash !== integrityHash) {
          issues.push({
            line: i + 1,
            entryId: entry.id,
            message: 'Hash mismatch - entry may have been tampered with',
          });
        }
      } catch (error) {
        issues.push({
          line: i + 1,
          message: `Parse error: ${error.message}`,
        });
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      totalEntries: lines.length,
    };
  }
}

export default new AuditTrail();
