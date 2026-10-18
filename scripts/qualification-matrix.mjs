#!/usr/bin/env node
import {readFileSync, realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname, relative, resolve, isAbsolute, sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildQualificationMatrix, matrixMarkdown} from './lib/qualification-matrix.mjs';

export function reportQualificationFile(filename, now = Date.now()) {
  const file = realpathSync(filename);
  const root = dirname(file);
  const ledger = JSON.parse(readFileSync(file, 'utf8'));
  const rows = buildQualificationMatrix(ledger.cases, ledger.receipts, {
    now,
    verifyArtifact(artifact) {
      try {
        if (isAbsolute(artifact.path)) return false;
        const path = realpathSync(resolve(root, artifact.path));
        const rel = relative(root, path);
        if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) return false;
        return createHash('sha256').update(readFileSync(path)).digest('hex') === artifact.sha256.toLowerCase();
      } catch { return false; }
    },
  });
  return {schema:'bobfwtools.qualification-matrix.v1', generatedAt:new Date(now).toISOString(),
    executionAuthorized:false, rows};
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [filename, format = 'json', ...extra] = process.argv.slice(2);
    if (!filename || extra.length || !['json','markdown'].includes(format)) throw Error('Usage: node scripts/qualification-matrix.mjs ledger.json [json|markdown]');
    const report = reportQualificationFile(filename);
    console.log(format === 'markdown' ? matrixMarkdown(report.rows) : JSON.stringify(report, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
