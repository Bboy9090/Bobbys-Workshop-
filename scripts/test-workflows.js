#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const workflowsDir = path.join(root, 'workflows');
const schemaPath = path.join(workflowsDir, 'workflow-schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.json') && full !== schemaPath) files.push(full);
  }
}
walk(workflowsDir);
files.sort();

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
const ids = new Map();
const errors = [];

for (const file of files) {
  const relative = path.relative(root, file);
  let workflow;
  try {
    workflow = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    errors.push(`${relative}: invalid JSON: ${error.message}`);
    continue;
  }

  if (!validate(workflow)) {
    for (const error of validate.errors || []) {
      errors.push(`${relative}: schema ${error.instancePath || '/'} ${error.message}`);
    }
  }

  if (workflow.id) {
    if (ids.has(workflow.id)) {
      errors.push(`${relative}: duplicate id "${workflow.id}" also used by ${ids.get(workflow.id)}`);
    } else {
      ids.set(workflow.id, relative);
    }
  }

  if (['high', 'destructive'].includes(workflow.risk_level)) {
    if (workflow.requires_authorization !== true) {
      errors.push(`${relative}: ${workflow.risk_level} risk must set requires_authorization=true`);
    }
    if (!workflow.authorization_prompt) {
      errors.push(`${relative}: ${workflow.risk_level} risk requires authorization_prompt`);
    }
    if (!workflow.legal_notice) {
      errors.push(`${relative}: ${workflow.risk_level} risk requires legal_notice`);
    }
  }

  const stepIds = new Set();
  for (const step of workflow.steps || []) {
    if (stepIds.has(step.id)) errors.push(`${relative}: duplicate step id "${step.id}"`);
    stepIds.add(step.id);
    if (step.type === 'command' && !step.action) {
      errors.push(`${relative}: command step "${step.id}" is missing action`);
    }
    if (step.type === 'prompt' && !step.prompt_text) {
      errors.push(`${relative}: prompt step "${step.id}" is missing prompt_text`);
    }
  }
}

if (errors.length) {
  console.error(`Workflow validation failed: ${errors.length} error(s)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Workflow validation passed: ${files.length} definitions, ${ids.size} unique ids`);
}
