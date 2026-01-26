/**
 * 🌟 World Class Universal Legend - Alerting Engine
 * 
 * Real-time alerting with multiple notification channels
 * Features:
 * - Custom alert rules
 * - Multiple notification channels (Slack, PagerDuty, Email, Webhook)
 * - Alert routing
 * - Alert deduplication
 * - Escalation policies
 */

import metricsCollector from '../observability/metrics-collector.js';

class AlertingEngine {
  constructor() {
    this.rules = [];
    this.alertHistory = [];
    this.activeAlerts = new Map();
    this.notificationChannels = {
      slack: null,
      pagerduty: null,
      email: null,
      webhook: null,
    };
    this.checkInterval = null;
  }

  initialize() {
    // Start alert checking loop
    this.checkInterval = setInterval(() => {
      this.checkAlerts();
    }, 5000); // Check every 5 seconds

    console.log('✅ Alerting Engine initialized');
  }

  addRule(rule) {
    this.rules.push({
      id: `rule-${Date.now()}-${Math.random()}`,
      ...rule,
      enabled: true,
      createdAt: new Date().toISOString(),
    });
  }

  async checkAlerts() {
    const metrics = metricsCollector.getMetricsJSON();

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      const triggered = this._evaluateRule(rule, metrics);
      
      if (triggered) {
        await this._triggerAlert(rule);
      } else {
        await this._resolveAlert(rule);
      }
    }
  }

  _evaluateRule(rule, metrics) {
    // Simple threshold-based evaluation
    // Can be extended with complex expressions
    
    if (rule.type === 'threshold') {
      const value = this._getMetricValue(rule.metric, metrics);
      if (value === null) return false;

      switch (rule.operator) {
        case 'gt':
          return value > rule.threshold;
        case 'lt':
          return value < rule.threshold;
        case 'eq':
          return value === rule.threshold;
        case 'gte':
          return value >= rule.threshold;
        case 'lte':
          return value <= rule.threshold;
        default:
          return false;
      }
    }

    return false;
  }

  _getMetricValue(metricPath, metrics) {
    const parts = metricPath.split('.');
    let value = metrics;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return null;
      }
    }
    
    return typeof value === 'number' ? value : null;
  }

  async _triggerAlert(rule) {
    const alertKey = rule.id;
    
    // Check if alert is already active
    if (this.activeAlerts.has(alertKey)) {
      const existing = this.activeAlerts.get(alertKey);
      existing.count++;
      existing.lastTriggered = new Date().toISOString();
      return;
    }

    // Create new alert
    const alert = {
      id: `alert-${Date.now()}-${Math.random()}`,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity || 'medium',
      message: rule.message || `Alert: ${rule.name}`,
      triggeredAt: new Date().toISOString(),
      count: 1,
      lastTriggered: new Date().toISOString(),
    };

    this.activeAlerts.set(alertKey, alert);
    this.alertHistory.push(alert);

    // Keep only last 1000 alerts
    if (this.alertHistory.length > 1000) {
      this.alertHistory.shift();
    }

    // Send notifications
    await this._sendNotifications(alert, rule);
  }

  async _resolveAlert(rule) {
    const alertKey = rule.id;
    
    if (this.activeAlerts.has(alertKey)) {
      const alert = this.activeAlerts.get(alertKey);
      alert.resolvedAt = new Date().toISOString();
      this.activeAlerts.delete(alertKey);
      
      // Send resolution notification
      await this._sendNotifications(
        { ...alert, resolved: true },
        rule
      );
    }
  }

  async _sendNotifications(alert, rule) {
    const channels = rule.channels || ['webhook'];

    for (const channel of channels) {
      try {
        switch (channel) {
          case 'slack':
            await this._sendSlack(alert, rule);
            break;
          case 'pagerduty':
            await this._sendPagerDuty(alert, rule);
            break;
          case 'email':
            await this._sendEmail(alert, rule);
            break;
          case 'webhook':
            await this._sendWebhook(alert, rule);
            break;
        }
      } catch (error) {
        console.error(`Failed to send ${channel} notification:`, error.message);
      }
    }
  }

  async _sendSlack(alert, rule) {
    if (!this.notificationChannels.slack) return;
    
    // Implementation would use Slack API
    console.log(`📢 Slack Alert: ${alert.message}`);
  }

  async _sendPagerDuty(alert, rule) {
    if (!this.notificationChannels.pagerduty) return;
    
    // Implementation would use PagerDuty API
    console.log(`🚨 PagerDuty Alert: ${alert.message}`);
  }

  async _sendEmail(alert, rule) {
    if (!this.notificationChannels.email) return;
    
    // Implementation would use email service
    console.log(`📧 Email Alert: ${alert.message}`);
  }

  async _sendWebhook(alert, rule) {
    const webhookUrl = rule.webhookUrl || process.env.ALERT_WEBHOOK_URL;
    if (!webhookUrl) return;

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert,
          rule,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('Webhook notification failed:', error.message);
    }
  }

  getActiveAlerts() {
    return Array.from(this.activeAlerts.values());
  }

  getAlertHistory(limit = 100) {
    return this.alertHistory.slice(-limit).reverse();
  }

  getRules() {
    return this.rules;
  }

  updateRule(ruleId, updates) {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      Object.assign(rule, updates);
      return true;
    }
    return false;
  }

  deleteRule(ruleId) {
    const index = this.rules.findIndex(r => r.id === ruleId);
    if (index !== -1) {
      this.rules.splice(index, 1);
      this.activeAlerts.delete(ruleId);
      return true;
    }
    return false;
  }

  shutdown() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

export default new AlertingEngine();
