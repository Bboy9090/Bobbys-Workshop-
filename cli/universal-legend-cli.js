#!/usr/bin/env node

/**
 * 🌟 World Class Universal Legend - CLI Tool
 * 
 * Command-line interface for Bobby's Secret Workshop API
 */

import { UniversalLegendClient } from '../sdk/typescript/src/index.js';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';
const API_KEY = process.env.API_KEY;

const client = new UniversalLegendClient({
  baseUrl: API_BASE,
  apiKey: API_KEY,
});

// Parse command line arguments
const [,, command, ...args] = process.argv;

async function main() {
  try {
    switch (command) {
      case 'performance:stats':
        await handlePerformanceStats();
        break;
      case 'performance:slow':
        await handleSlowRequests(args[0] || '10');
        break;
      case 'alerts:list':
        await handleListAlerts();
        break;
      case 'alerts:active':
        await handleActiveAlerts();
        break;
      case 'security:roles':
        await handleListRoles();
        break;
      case 'security:assign-role':
        await handleAssignRole(args[0], args[1]);
        break;
      case 'scalability:status':
        await handleScalabilityStatus();
        break;
      case 'health':
        await handleHealth();
        break;
      case 'metrics':
        await handleMetrics(args[0] || 'json');
        break;
      default:
        showHelp();
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

async function handlePerformanceStats() {
  const response = await client.getPerformanceStats();
  console.log(JSON.stringify(response.data, null, 2));
}

async function handleSlowRequests(limit) {
  const response = await client.getSlowRequests(parseInt(limit));
  console.log(JSON.stringify(response.data, null, 2));
}

async function handleListAlerts() {
  const response = await client.getAlertRules();
  console.log(JSON.stringify(response.data, null, 2));
}

async function handleActiveAlerts() {
  const response = await client.getActiveAlerts();
  console.log(JSON.stringify(response.data, null, 2));
}

async function handleListRoles() {
  const response = await client.getRoles();
  console.log(JSON.stringify(response.data, null, 2));
}

async function handleAssignRole(userId, roleId) {
  if (!userId || !roleId) {
    console.error('Usage: universal-legend security:assign-role <userId> <roleId>');
    process.exit(1);
  }
  const response = await client.assignRole(userId, roleId);
  console.log(JSON.stringify(response.data, null, 2));
}

async function handleScalabilityStatus() {
  const response = await client.getAutoScalerStatus();
  console.log(JSON.stringify(response.data, null, 2));
}

async function handleHealth() {
  const response = await client.getHealth();
  console.log(JSON.stringify(response.data, null, 2));
}

async function handleMetrics(format) {
  const response = await client.getMetrics(format);
  if (format === 'prometheus') {
    console.log(response);
  } else {
    console.log(JSON.stringify(response.data, null, 2));
  }
}

function showHelp() {
  console.log(`
🌟 World Class Universal Legend CLI

Usage: universal-legend <command> [options]

Commands:
  performance:stats              Get performance statistics
  performance:slow [limit]       Get slow requests (default: 10)
  alerts:list                   List all alert rules
  alerts:active                 Get active alerts
  security:roles                List all roles
  security:assign-role <user> <role>  Assign role to user
  scalability:status            Get scalability status
  health                        Get system health
  metrics [format]              Get metrics (json|prometheus)

Environment Variables:
  API_BASE_URL                  API base URL (default: http://localhost:3001)
  API_KEY                       API key for authentication

Examples:
  universal-legend performance:stats
  universal-legend alerts:active
  universal-legend security:assign-role user123 admin
  universal-legend metrics prometheus
`);
}

main();
