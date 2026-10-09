#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const tools = ['adb', 'fastboot'];
let missing = 0;
for (const tool of tools) {
  const result = spawnSync('which', [tool], { encoding: 'utf8' });
  if (result.status === 0) console.log(`${tool}: available (${result.stdout.trim()})`);
  else { console.log(`${tool}: unavailable`); missing++; }
}
console.log(missing ? `Android readiness: ${missing} tool(s) unavailable` : 'Android readiness: all tools available');
process.exit(0);
