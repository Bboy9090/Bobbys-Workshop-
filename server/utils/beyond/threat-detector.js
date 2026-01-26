/**
 * 🚀 Beyond World Class - Advanced Threat Detection
 * 
 * Zero-trust security with:
 * - Behavioral analysis
 * - Threat intelligence
 * - Intrusion detection
 * - Automated response
 */

import auditTrail from '../world-class/audit-trail.js';
import rbac from '../world-class/rbac.js';

class ThreatDetector {
  constructor() {
    this.userBehavior = new Map(); // userId -> behavior profile
    this.threatPatterns = new Map();
    this.activeThreats = new Map();
    this.riskScores = new Map(); // userId -> risk score
    this.blockedIPs = new Set();
    this.blockedUsers = new Set();
  }

  // Analyze user behavior
  analyzeBehavior(userId, action, context = {}) {
    if (!this.userBehavior.has(userId)) {
      this.userBehavior.set(userId, {
        userId,
        actions: [],
        patterns: {},
        baseline: {},
        anomalies: [],
        createdAt: new Date().toISOString(),
      });
    }

    const behavior = this.userBehavior.get(userId);
    behavior.actions.push({
      action,
      context,
      timestamp: new Date().toISOString(),
    });

    // Keep only last 1000 actions
    if (behavior.actions.length > 1000) {
      behavior.actions.shift();
    }

    // Detect anomalies
    const anomaly = this._detectBehaviorAnomaly(userId, action, context);
    if (anomaly) {
      behavior.anomalies.push(anomaly);
      this._updateRiskScore(userId, anomaly);
    }

    return behavior;
  }

  _detectBehaviorAnomaly(userId, action, context) {
    const behavior = this.userBehavior.get(userId);
    if (!behavior || behavior.actions.length < 10) {
      return null; // Need more data
    }

    // Analyze action frequency
    const recentActions = behavior.actions.slice(-100);
    const actionFrequency = {};
    for (const act of recentActions) {
      actionFrequency[act.action] = (actionFrequency[act.action] || 0) + 1;
    }

    // Check for unusual action frequency
    const currentActionCount = actionFrequency[action] || 0;
    const avgActionCount = recentActions.length / Object.keys(actionFrequency).length;
    
    if (currentActionCount > avgActionCount * 3) {
      return {
        type: 'unusual_frequency',
        action,
        frequency: currentActionCount,
        expected: avgActionCount,
        severity: 'medium',
        timestamp: new Date().toISOString(),
      };
    }

    // Check for unusual time patterns
    const recentTimestamps = recentActions.map(a => new Date(a.timestamp).getHours());
    const currentHour = new Date().getHours();
    const hourFrequency = {};
    for (const hour of recentTimestamps) {
      hourFrequency[hour] = (hourFrequency[hour] || 0) + 1;
    }

    const currentHourCount = hourFrequency[currentHour] || 0;
    const avgHourCount = recentTimestamps.length / 24;

    if (currentHourCount === 0 && avgHourCount > 0) {
      return {
        type: 'unusual_time',
        action,
        hour: currentHour,
        expected: Object.keys(hourFrequency).map(h => parseInt(h)),
        severity: 'low',
        timestamp: new Date().toISOString(),
      };
    }

    // Check for privilege escalation attempts
    if (action.includes('admin') || action.includes('role') || action.includes('permission')) {
      const userRoles = rbac.getUserRoles(userId);
      if (!userRoles.includes('admin')) {
        return {
          type: 'privilege_escalation_attempt',
          action,
          userRoles,
          severity: 'high',
          timestamp: new Date().toISOString(),
        };
      }
    }

    return null;
  }

  _updateRiskScore(userId, anomaly) {
    const currentScore = this.riskScores.get(userId) || 0;
    let newScore = currentScore;

    switch (anomaly.severity) {
      case 'critical':
        newScore += 50;
        break;
      case 'high':
        newScore += 25;
        break;
      case 'medium':
        newScore += 10;
        break;
      case 'low':
        newScore += 5;
        break;
    }

    // Decay risk score over time
    newScore = Math.max(0, newScore - 1);

    this.riskScores.set(userId, newScore);

    // Take action if risk score is high
    if (newScore > 75) {
      this._handleHighRisk(userId, newScore, anomaly);
    }
  }

  _handleHighRisk(userId, riskScore, anomaly) {
    // Log security event
    auditTrail.logSecurityEvent('high_risk_user_detected', {
      userId,
      riskScore,
      anomaly,
    });

    // Block user if risk is critical
    if (riskScore > 90) {
      this.blockedUsers.add(userId);
      auditTrail.logSecurityEvent('user_blocked', {
        userId,
        reason: 'High risk score',
        riskScore,
      });
    }

    // Create threat record
    const threatId = `threat-${Date.now()}-${Math.random()}`;
    this.activeThreats.set(threatId, {
      id: threatId,
      userId,
      riskScore,
      anomaly,
      detectedAt: new Date().toISOString(),
      status: 'active',
    });
  }

  // Detect intrusion patterns
  detectIntrusion(ip, request) {
    // Check if IP is blocked
    if (this.blockedIPs.has(ip)) {
      return {
        isIntrusion: true,
        reason: 'IP is blocked',
        action: 'blocked',
      };
    }

    // Check for common attack patterns
    const attackPatterns = [
      { pattern: /\.\.\//g, name: 'path_traversal' },
      { pattern: /<script/i, name: 'xss_attempt' },
      { pattern: /union.*select/i, name: 'sql_injection' },
      { pattern: /eval\(/i, name: 'code_injection' },
    ];

    const requestString = JSON.stringify(request).toLowerCase();
    for (const attack of attackPatterns) {
      if (attack.pattern.test(requestString)) {
        this.blockedIPs.add(ip);
        auditTrail.logSecurityEvent('intrusion_detected', {
          ip,
          attackType: attack.name,
          request,
        });

        return {
          isIntrusion: true,
          reason: `Detected ${attack.name} attack pattern`,
          action: 'blocked',
        };
      }
    }

    return { isIntrusion: false };
  }

  // Get risk score for user
  getRiskScore(userId) {
    return {
      userId,
      score: this.riskScores.get(userId) || 0,
      level: this._getRiskLevel(this.riskScores.get(userId) || 0),
      isBlocked: this.blockedUsers.has(userId),
    };
  }

  _getRiskLevel(score) {
    if (score >= 90) return 'critical';
    if (score >= 75) return 'high';
    if (score >= 50) return 'medium';
    if (score >= 25) return 'low';
    return 'minimal';
  }

  // Get active threats
  getActiveThreats() {
    return Array.from(this.activeThreats.values()).filter(t => t.status === 'active');
  }

  // Resolve threat
  resolveThreat(threatId, resolution) {
    const threat = this.activeThreats.get(threatId);
    if (threat) {
      threat.status = 'resolved';
      threat.resolvedAt = new Date().toISOString();
      threat.resolution = resolution;
      return true;
    }
    return false;
  }

  // Unblock user/IP
  unblockUser(userId) {
    this.blockedUsers.delete(userId);
    this.riskScores.set(userId, 0);
    auditTrail.logSecurityEvent('user_unblocked', { userId });
    return true;
  }

  unblockIP(ip) {
    this.blockedIPs.delete(ip);
    auditTrail.logSecurityEvent('ip_unblocked', { ip });
    return true;
  }
}

export default new ThreatDetector();
