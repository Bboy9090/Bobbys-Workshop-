/**
 * 🏆 Production-Grade Route Upgrade Script
 * 
 * Applies production-grade middleware to all Infinite Legendary routes
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const routesDir = path.join(__dirname, '../server/routes/v1/infinite');

const middlewareImports = `import { validateInfiniteFeature, manageInfiniteResources } from '../../../middleware/infinite-validation.js';
import infiniteErrorHandler from '../../../utils/infinite/error-handler.js';
import infinitePerformanceMonitor from '../../../utils/infinite/performance-monitor.js';
import infiniteRateLimiter from '../../../middleware/infinite-rate-limit.js';`;

const middlewareSetup = `
// Apply production-grade middleware
router.use(manageInfiniteResources);
router.use(infiniteRateLimiter.createRateLimitMiddleware('FEATURE_NAME'));`;

const featureMap = {
  'quantum.js': 'quantum',
  'forecast.js': 'forecast',
  'swarm.js': 'swarm',
  'causal.js': 'causal',
  'consciousness.js': 'consciousness',
  'replicate.js': 'replicate',
  'neuromorphic.js': 'neuromorphic',
  'simulation.js': 'simulation',
  'multi-optimize.js': 'multi-optimize',
  'blockchain.js': 'blockchain',
};

async function upgradeRoute(filePath, featureName) {
  try {
    let content = await fs.readFile(filePath, 'utf-8');
    
    // Check if already upgraded
    if (content.includes('Production-Grade')) {
      console.log(`✓ ${path.basename(filePath)} already upgraded`);
      return;
    }

    // Add middleware imports if not present
    if (!content.includes('infinite-validation.js')) {
      const importMatch = content.match(/import express from 'express';\nimport \w+ from/);
      if (importMatch) {
        content = content.replace(
          importMatch[0],
          `import express from 'express';\n${middlewareImports.replace('FEATURE_NAME', featureName)}\nimport`
        );
      }
    }

    // Add middleware setup
    if (!content.includes('manageInfiniteResources')) {
      const routerMatch = content.match(/const router = express\.Router\(\);/);
      if (routerMatch) {
        content = content.replace(
          routerMatch[0],
          `const router = express.Router();\n${middlewareSetup.replace('FEATURE_NAME', featureName)}`
        );
      }
    }

    // Update title comment
    content = content.replace(
      /♾️ Infinite Legendary - (\w+) API/,
      '♾️ Infinite Legendary - $1 API (Production-Grade)'
    );

    await fs.writeFile(filePath, content, 'utf-8');
    console.log(`✓ Upgraded ${path.basename(filePath)}`);
  } catch (error) {
    console.error(`✗ Error upgrading ${filePath}:`, error.message);
  }
}

async function main() {
  try {
    const files = await fs.readdir(routesDir);
    
    for (const file of files) {
      if (file.endsWith('.js') && file !== 'health.js') {
        const featureName = featureMap[file] || file.replace('.js', '');
        const filePath = path.join(routesDir, file);
        await upgradeRoute(filePath, featureName);
      }
    }
    
    console.log('\n✅ All routes upgraded to production-grade!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
