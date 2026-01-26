/**
 * Operation Loader
 * 
 * Loads operation specifications from the catalog.
 * 
 * @module core/catalog/operation-loader
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OPERATIONS_DIR = path.join(__dirname, 'operations');

/**
 * Load operation specification by ID
 * 
 * @param {string} operationId - Operation identifier (e.g., "reboot_device")
 * @returns {Promise<Object|null>} Operation specification or null if not found
 */
export async function loadOperationSpec(operationId) {
  try {
    // Try different filename formats
    const possibleFiles = [
      `${operationId}.json`,
      `${operationId.replace(/_/g, '-')}.json`,
      `${operationId.replace(/-/g, '_')}.json`
    ];

    for (const filename of possibleFiles) {
      const filePath = path.join(OPERATIONS_DIR, filename);
      
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const spec = JSON.parse(content);
        
        // Validate spec has required fields
        if (!spec.operation || !spec.allowedRoles) {
          console.warn(`Invalid operation spec in ${filename}: missing required fields`);
          continue;
        }
        
        return spec;
      } catch (err) {
        // File doesn't exist, try next
        if (err.code !== 'ENOENT') {
          console.warn(`Error reading ${filePath}:`, err.message);
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error loading operation spec for ${operationId}:`, error);
    return null;
  }
}

/**
 * List all available operations
 * 
 * @returns {Promise<Array>} Array of operation specifications
 */
export async function listAllOperations() {
  try {
    const files = await fs.readdir(OPERATIONS_DIR);
    const operations = [];
    
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      
      try {
        const filePath = path.join(OPERATIONS_DIR, file);
        const content = await fs.readFile(filePath, 'utf8');
        const spec = JSON.parse(content);
        
        if (spec.operation && spec.allowedRoles) {
          operations.push(spec);
        }
      } catch (err) {
        console.warn(`Error loading operation from ${file}:`, err.message);
      }
    }
    
    return operations;
  } catch (error) {
    console.error('Error listing operations:', error);
    return [];
  }
}

/**
 * Filter operations by role
 * 
 * @param {string} role - User role
 * @returns {Promise<Array>} Array of operations allowed for the role
 */
export async function listOperationsForRole(role) {
  const allOperations = await listAllOperations();
  
  return allOperations.filter(op => {
    return op.allowedRoles && op.allowedRoles.includes(role);
  });
}
