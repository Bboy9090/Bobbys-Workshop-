/**
 * Workflows API (v1)
 *
 * Lists available workflows from runtime manifests.
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const MANIFEST_DIRS = [
  path.join(process.cwd(), 'runtime', 'manifests'),
  path.join(__dirname, '..', '..', '..', 'runtime', 'manifests'),
  path.join(__dirname, '..', '..', 'runtime', 'manifests')
];

const MANIFEST_FILES = ['workflows-v2.json', 'workflows.json'];

/**
 * Locate the first manifest file that exists in the configured manifest directories.
 *
 * @returns {string|null} Absolute path to the first found manifest file, or `null` if none is found.
 */
function findManifestPath() {
  for (const dir of MANIFEST_DIRS) {
    for (const file of MANIFEST_FILES) {
      const candidate = path.join(dir, file);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

/**
 * Load workflows from the first available manifest file on disk.
 *
 * Attempts to locate a workflows manifest, parse it as JSON, and return its "workflows" array (or an empty array if the key is absent). Returns `null` if no manifest is found or if reading/parsing fails.
 *
 * @returns {Array|null} The workflows array from the manifest, an empty array when the manifest contains no `workflows` key, or `null` if no manifest is available or on read/parse error.
 */
function loadWorkflows() {
  const manifestPath = findManifestPath();
  if (!manifestPath) return null;

  try {
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(raw);
    return manifest.workflows || [];
  } catch (error) {
    console.error('[Workflows] Failed to load workflows manifest:', error);
    return null;
  }
}

router.get('/', (req, res) => {
  const workflows = loadWorkflows();
  if (!workflows) {
    return res.sendError('WORKFLOWS_NOT_AVAILABLE', 'Workflow manifest not available', null, 503);
  }

  const summaries = workflows.map((workflow) => ({
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    tags: workflow.tags || [],
    required_gates: workflow.required_gates || [],
    stepCount: Array.isArray(workflow.steps) ? workflow.steps.length : 0
  }));

  return res.sendEnvelope({
    workflows: summaries,
    count: summaries.length,
    timestamp: new Date().toISOString()
  });
});

router.get('/:id', (req, res) => {
  const workflows = loadWorkflows();
  if (!workflows) {
    return res.sendError('WORKFLOWS_NOT_AVAILABLE', 'Workflow manifest not available', null, 503);
  }

  const workflow = workflows.find((w) => w.id === req.params.id);
  if (!workflow) {
    return res.sendError('WORKFLOW_NOT_FOUND', 'Workflow not found', {
      workflowId: req.params.id
    }, 404);
  }

  return res.sendEnvelope({
    workflow
  });
});

export default router;