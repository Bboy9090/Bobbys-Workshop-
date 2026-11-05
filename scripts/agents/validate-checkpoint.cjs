'use strict';
const { readFileSync } = require('node:fs');
const { validateCheckpoint } = require('./checkpoint-validator.cjs');
try {
  if (process.argv.length !== 3) throw new Error('Usage: node scripts/agents/validate-checkpoint.cjs <checkpoint.json>');
  const result = validateCheckpoint(JSON.parse(readFileSync(process.argv[2], 'utf8')));
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exitCode = result.valid ? 0 : 1;
} catch {
  process.stderr.write('Cannot validate checkpoint. Supply one readable JSON file with the required checkpoint fields.\n');
  process.exitCode = 2;
}
