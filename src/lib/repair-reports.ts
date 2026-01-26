/**
 * Repair Reports System
 * 
 * GOD MODE: Professional documentation generation for device repairs.
 * Creates comprehensive reports with full operation history.
 */

import { UnifiedDevice } from '@/hooks/use-ultimate-device-manager';
import { OperationResult, OperationType } from '@/lib/secret-operations';

// Report types
export interface RepairReport {
  id: string;
  generatedAt: string;
  version: string;
  
  // Device info
  device: {
    serial: string;
    platform: string;
    manufacturer?: string;
    model?: string;
    mode: string;
    displayName: string;
  };
  
  // Customer info (optional)
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
    ticketNumber?: string;
  };
  
  // Technician info
  technician?: {
    name?: string;
    id?: string;
  };
  
  // Operations performed
  operations: OperationSummary[];
  
  // Diagnostics results
  diagnostics?: DiagnosticResult[];
  
  // Summary
  summary: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    totalDuration: number;
    overallStatus: 'success' | 'partial' | 'failed';
  };
  
  // Notes
  notes?: string;
  
  // Signature
  signature?: {
    date: string;
    accepted: boolean;
  };
}

export interface OperationSummary {
  type: OperationType;
  name: string;
  startTime: string;
  endTime: string;
  duration: number;
  success: boolean;
  error?: string;
  steps: {
    name: string;
    status: string;
  }[];
}

export interface DiagnosticResult {
  category: string;
  name: string;
  status: 'pass' | 'fail' | 'warning' | 'unknown';
  value?: string;
  notes?: string;
}

/**
 * Generate a unique report ID
 */
function generateReportId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `RPT-${timestamp.toUpperCase()}-${random.toUpperCase()}`;
}

/**
 * Create a repair report from device and operations
 */
export function createRepairReport(
  device: UnifiedDevice,
  operations: OperationResult[],
  diagnostics?: DiagnosticResult[],
  customer?: RepairReport['customer'],
  technician?: RepairReport['technician'],
  notes?: string
): RepairReport {
  const successCount = operations.filter(op => op.success).length;
  const totalDuration = operations.reduce((sum, op) => sum + op.duration, 0);
  
  let overallStatus: 'success' | 'partial' | 'failed' = 'failed';
  if (successCount === operations.length) {
    overallStatus = 'success';
  } else if (successCount > 0) {
    overallStatus = 'partial';
  }
  
  return {
    id: generateReportId(),
    generatedAt: new Date().toISOString(),
    version: '1.0.0',
    
    device: {
      serial: device.serial || 'Unknown',
      platform: device.platform,
      manufacturer: device.manufacturer,
      model: device.model,
      mode: device.mode,
      displayName: device.displayName,
    },
    
    customer,
    technician,
    
    operations: operations.map(op => ({
      type: op.operationType,
      name: op.operationType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      startTime: new Date(op.startTime).toISOString(),
      endTime: new Date(op.endTime).toISOString(),
      duration: op.duration,
      success: op.success,
      error: op.error,
      steps: op.steps.map(s => ({
        name: s.name,
        status: s.status,
      })),
    })),
    
    diagnostics,
    
    summary: {
      totalOperations: operations.length,
      successfulOperations: successCount,
      failedOperations: operations.length - successCount,
      totalDuration,
      overallStatus,
    },
    
    notes,
  };
}

/**
 * Export report as JSON
 */
export function exportReportAsJSON(report: RepairReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Export report as plain text
 */
export function exportReportAsText(report: RepairReport): string {
  const lines: string[] = [];
  
  lines.push('═'.repeat(60));
  lines.push('           BOBBY\'S WORKSHOP - REPAIR REPORT');
  lines.push('═'.repeat(60));
  lines.push('');
  
  // Header
  lines.push(`Report ID: ${report.id}`);
  lines.push(`Generated: ${new Date(report.generatedAt).toLocaleString()}`);
  lines.push('');
  
  // Device Info
  lines.push('─'.repeat(40));
  lines.push('DEVICE INFORMATION');
  lines.push('─'.repeat(40));
  lines.push(`Serial:       ${report.device.serial}`);
  lines.push(`Platform:     ${report.device.platform.toUpperCase()}`);
  lines.push(`Manufacturer: ${report.device.manufacturer || 'Unknown'}`);
  lines.push(`Model:        ${report.device.model || 'Unknown'}`);
  lines.push(`Mode:         ${report.device.mode}`);
  lines.push('');
  
  // Customer Info
  if (report.customer) {
    lines.push('─'.repeat(40));
    lines.push('CUSTOMER INFORMATION');
    lines.push('─'.repeat(40));
    if (report.customer.name) lines.push(`Name:    ${report.customer.name}`);
    if (report.customer.phone) lines.push(`Phone:   ${report.customer.phone}`);
    if (report.customer.email) lines.push(`Email:   ${report.customer.email}`);
    if (report.customer.ticketNumber) lines.push(`Ticket:  ${report.customer.ticketNumber}`);
    lines.push('');
  }
  
  // Operations
  lines.push('─'.repeat(40));
  lines.push('OPERATIONS PERFORMED');
  lines.push('─'.repeat(40));
  
  report.operations.forEach((op, i) => {
    const status = op.success ? '✓ SUCCESS' : '✗ FAILED';
    lines.push(`${i + 1}. ${op.name}`);
    lines.push(`   Status:   ${status}`);
    lines.push(`   Duration: ${(op.duration / 1000).toFixed(2)}s`);
    lines.push(`   Started:  ${new Date(op.startTime).toLocaleTimeString()}`);
    if (op.error) {
      lines.push(`   Error:    ${op.error}`);
    }
    lines.push('');
  });
  
  // Diagnostics
  if (report.diagnostics && report.diagnostics.length > 0) {
    lines.push('─'.repeat(40));
    lines.push('DIAGNOSTIC RESULTS');
    lines.push('─'.repeat(40));
    
    report.diagnostics.forEach(diag => {
      const statusSymbol = {
        pass: '✓',
        fail: '✗',
        warning: '⚠',
        unknown: '?'
      }[diag.status];
      lines.push(`${statusSymbol} ${diag.name}: ${diag.value || diag.status.toUpperCase()}`);
    });
    lines.push('');
  }
  
  // Summary
  lines.push('─'.repeat(40));
  lines.push('SUMMARY');
  lines.push('─'.repeat(40));
  lines.push(`Total Operations:     ${report.summary.totalOperations}`);
  lines.push(`Successful:           ${report.summary.successfulOperations}`);
  lines.push(`Failed:               ${report.summary.failedOperations}`);
  lines.push(`Total Duration:       ${(report.summary.totalDuration / 1000).toFixed(2)}s`);
  lines.push(`Overall Status:       ${report.summary.overallStatus.toUpperCase()}`);
  lines.push('');
  
  // Notes
  if (report.notes) {
    lines.push('─'.repeat(40));
    lines.push('NOTES');
    lines.push('─'.repeat(40));
    lines.push(report.notes);
    lines.push('');
  }
  
  // Footer
  lines.push('═'.repeat(60));
  lines.push('         BOBBY\'S WORKSHOP - USE RESPONSIBLY');
  lines.push('═'.repeat(60));
  
  return lines.join('\n');
}

/**
 * Export report as HTML
 */
export function exportReportAsHTML(report: RepairReport): string {
  const statusColor = {
    success: '#22c55e',
    partial: '#eab308',
    failed: '#ef4444'
  }[report.summary.overallStatus];

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Repair Report - ${report.id}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a; 
      color: #ededed; 
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header { 
      text-align: center; 
      border-bottom: 2px solid #2dd4ff; 
      padding-bottom: 20px; 
      margin-bottom: 30px;
    }
    .header h1 { color: #2dd4ff; font-size: 28px; margin-bottom: 10px; }
    .header p { color: #9aa0a6; }
    .section { 
      background: #161a1f; 
      border-radius: 8px; 
      padding: 20px; 
      margin-bottom: 20px;
      border: 1px solid #1f2632;
    }
    .section h2 { 
      color: #2dd4ff; 
      font-size: 16px; 
      margin-bottom: 15px; 
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .info-row { 
      display: flex; 
      justify-content: space-between; 
      padding: 8px 0;
      border-bottom: 1px solid #1f2632;
    }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #9aa0a6; }
    .info-value { color: #ededed; font-weight: 500; }
    .operation { 
      background: #0f1114; 
      border-radius: 6px; 
      padding: 15px; 
      margin-bottom: 10px;
    }
    .operation.success { border-left: 3px solid #22c55e; }
    .operation.failed { border-left: 3px solid #ef4444; }
    .operation h3 { font-size: 14px; margin-bottom: 8px; }
    .operation p { font-size: 12px; color: #9aa0a6; }
    .summary-box {
      background: ${statusColor}20;
      border: 1px solid ${statusColor};
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    }
    .summary-status { 
      font-size: 24px; 
      font-weight: bold; 
      color: ${statusColor};
      text-transform: uppercase;
    }
    .footer { 
      text-align: center; 
      margin-top: 40px; 
      padding-top: 20px; 
      border-top: 1px solid #1f2632;
      color: #9aa0a6;
      font-size: 12px;
    }
    @media print {
      body { background: white; color: black; }
      .section { border: 1px solid #ccc; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔧 BOBBY'S WORKSHOP</h1>
    <p>Repair Report</p>
  </div>

  <div class="section">
    <h2>Report Information</h2>
    <div class="info-row">
      <span class="info-label">Report ID</span>
      <span class="info-value">${report.id}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Generated</span>
      <span class="info-value">${new Date(report.generatedAt).toLocaleString()}</span>
    </div>
  </div>

  <div class="section">
    <h2>Device Information</h2>
    <div class="info-row">
      <span class="info-label">Serial</span>
      <span class="info-value">${report.device.serial}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Platform</span>
      <span class="info-value">${report.device.platform.toUpperCase()}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Model</span>
      <span class="info-value">${report.device.manufacturer || ''} ${report.device.model || 'Unknown'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Mode</span>
      <span class="info-value">${report.device.mode}</span>
    </div>
  </div>

  ${report.customer ? `
  <div class="section">
    <h2>Customer Information</h2>
    ${report.customer.name ? `<div class="info-row"><span class="info-label">Name</span><span class="info-value">${report.customer.name}</span></div>` : ''}
    ${report.customer.phone ? `<div class="info-row"><span class="info-label">Phone</span><span class="info-value">${report.customer.phone}</span></div>` : ''}
    ${report.customer.email ? `<div class="info-row"><span class="info-label">Email</span><span class="info-value">${report.customer.email}</span></div>` : ''}
    ${report.customer.ticketNumber ? `<div class="info-row"><span class="info-label">Ticket</span><span class="info-value">${report.customer.ticketNumber}</span></div>` : ''}
  </div>
  ` : ''}

  <div class="section">
    <h2>Operations Performed</h2>
    ${report.operations.map(op => `
      <div class="operation ${op.success ? 'success' : 'failed'}">
        <h3>${op.success ? '✓' : '✗'} ${op.name}</h3>
        <p>Duration: ${(op.duration / 1000).toFixed(2)}s | ${op.success ? 'Successful' : `Failed: ${op.error || 'Unknown error'}`}</p>
      </div>
    `).join('')}
  </div>

  <div class="section">
    <div class="summary-box">
      <div class="summary-status">${report.summary.overallStatus}</div>
      <p style="margin-top: 10px; color: #9aa0a6;">
        ${report.summary.successfulOperations}/${report.summary.totalOperations} operations successful
        (${(report.summary.totalDuration / 1000).toFixed(2)}s total)
      </p>
    </div>
  </div>

  ${report.notes ? `
  <div class="section">
    <h2>Notes</h2>
    <p style="white-space: pre-wrap;">${report.notes}</p>
  </div>
  ` : ''}

  <div class="footer">
    <p>Generated by Bobby's Workshop v${report.version}</p>
    <p>Use responsibly. Repair ethically. Respect the law.</p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Download report as file
 */
export function downloadReport(
  report: RepairReport,
  format: 'json' | 'txt' | 'html'
): void {
  let content: string;
  let mimeType: string;
  let extension: string;
  
  switch (format) {
    case 'json':
      content = exportReportAsJSON(report);
      mimeType = 'application/json';
      extension = 'json';
      break;
    case 'txt':
      content = exportReportAsText(report);
      mimeType = 'text/plain';
      extension = 'txt';
      break;
    case 'html':
      content = exportReportAsHTML(report);
      mimeType = 'text/html';
      extension = 'html';
      break;
  }
  
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `repair-report-${report.id}.${extension}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Save report to local storage
 */
export function saveReportToStorage(report: RepairReport): void {
  const reports = getReportsFromStorage();
  reports.unshift(report);
  // Keep only last 100 reports
  const trimmed = reports.slice(0, 100);
  localStorage.setItem('bw:repair-reports', JSON.stringify(trimmed));
}

/**
 * Get reports from local storage
 */
export function getReportsFromStorage(): RepairReport[] {
  try {
    const stored = localStorage.getItem('bw:repair-reports');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Delete report from storage
 */
export function deleteReportFromStorage(reportId: string): void {
  const reports = getReportsFromStorage();
  const filtered = reports.filter(r => r.id !== reportId);
  localStorage.setItem('bw:repair-reports', JSON.stringify(filtered));
}
