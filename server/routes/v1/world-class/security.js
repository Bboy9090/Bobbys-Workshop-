/**
 * 🌟 World Class Universal Legend - Security API
 * 
 * Enterprise security endpoints (RBAC, MFA, Encryption, Audit)
 */

import express from 'express';
import rbac from '../../../utils/world-class/rbac.js';
import mfa from '../../../utils/world-class/mfa.js';
import encryption from '../../../utils/world-class/encryption.js';
import auditTrail from '../../../utils/world-class/audit-trail.js';
import { requirePermission, requireRole } from '../../../middleware/rbac-middleware.js';

const router = express.Router();

// ============================================
// RBAC Endpoints
// ============================================

/**
 * GET /api/v1/world-class/security/rbac/roles
 * Get all roles (admin only)
 */
router.get('/rbac/roles', requireRole('admin'), (req, res) => {
  try {
    const roles = rbac.getAllRoles();
    res.json({
      envelope: {
        version: '1.0',
        operation: 'get_roles',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: { roles },
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'get_roles',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * POST /api/v1/world-class/security/rbac/roles/:userId
 * Assign role to user (admin only)
 */
router.post('/rbac/roles/:userId', requireRole('admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { roleId } = req.body;
    
    rbac.assignRole(userId, roleId);
    await auditTrail.logUserAction(req.user?.id || 'system', 'assign_role', { userId, roleId });

    res.json({
      envelope: {
        version: '1.0',
        operation: 'assign_role',
        mode: 'write',
        timestamp: new Date().toISOString(),
      },
      data: { message: 'Role assigned successfully' },
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'assign_role',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * GET /api/v1/world-class/security/rbac/users/:userId/permissions
 * Check user permissions
 */
router.get('/rbac/users/:userId/permissions', requirePermission('rbac:read'), (req, res) => {
  try {
    const { userId } = req.params;
    const roles = rbac.getUserRoles(userId);
    const permissions = roles.flatMap(roleId => rbac.getRolePermissions(roleId));

    res.json({
      envelope: {
        version: '1.0',
        operation: 'get_user_permissions',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: { userId, roles, permissions },
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'get_user_permissions',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

// ============================================
// MFA Endpoints
// ============================================

/**
 * POST /api/v1/world-class/security/mfa/setup
 * Setup MFA for user
 */
router.post('/mfa/setup', async (req, res) => {
  try {
    const { userId } = req.body;
    const setup = mfa.generateTOTPSecret(userId);
    
    await auditTrail.logUserAction(userId, 'mfa_setup_initiated');

    res.json({
      envelope: {
        version: '1.0',
        operation: 'setup_mfa',
        mode: 'write',
        timestamp: new Date().toISOString(),
      },
      data: setup,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'setup_mfa',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * POST /api/v1/world-class/security/mfa/enable
 * Enable MFA for user
 */
router.post('/mfa/enable', async (req, res) => {
  try {
    const { userId, token } = req.body;
    const result = mfa.enableMFA(userId, token);
    
    if (result.success) {
      await auditTrail.logAuthentication(userId, 'mfa_enabled');
    } else {
      await auditTrail.logAuthentication(userId, 'mfa_enable_failed', { error: result.error });
    }

    res.json({
      envelope: {
        version: '1.0',
        operation: 'enable_mfa',
        mode: 'write',
        timestamp: new Date().toISOString(),
      },
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'enable_mfa',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * GET /api/v1/world-class/security/mfa/status/:userId
 * Get MFA status
 */
router.get('/mfa/status/:userId', requirePermission('mfa:read'), (req, res) => {
  try {
    const { userId } = req.params;
    const status = mfa.getMFAStatus(userId);

    res.json({
      envelope: {
        version: '1.0',
        operation: 'get_mfa_status',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: status,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'get_mfa_status',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

// ============================================
// Audit Trail Endpoints
// ============================================

/**
 * GET /api/v1/world-class/security/audit/search
 * Search audit logs (auditor role required)
 */
router.get('/audit/search', requireRole('auditor', 'admin'), async (req, res) => {
  try {
    const { q, limit = 100 } = req.query;
    const results = await auditTrail.search(q);

    res.json({
      envelope: {
        version: '1.0',
        operation: 'search_audit_logs',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: {
        results: results.slice(0, parseInt(limit)),
        total: results.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'search_audit_logs',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * GET /api/v1/world-class/security/audit/compliance-report
 * Generate compliance report (auditor role required)
 */
router.get('/audit/compliance-report', requireRole('auditor', 'admin'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        envelope: {
          version: '1.0',
          operation: 'generate_compliance_report',
          mode: 'error',
          timestamp: new Date().toISOString(),
        },
        error: { message: 'startDate and endDate are required' },
      });
    }

    const report = await auditTrail.generateComplianceReport(startDate, endDate);

    res.json({
      envelope: {
        version: '1.0',
        operation: 'generate_compliance_report',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'generate_compliance_report',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

export default router;
