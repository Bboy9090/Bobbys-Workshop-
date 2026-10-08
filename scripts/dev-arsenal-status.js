#!/usr/bin/env node
import { existsSync } from 'node:fs';

const paths = [
  ['ADB/Fastboot readiness script', 'scripts/check-android-tools.js'],
  ['Workflow validator', 'scripts/test-workflows.js'],
  ['Tauri backend', 'src-tauri/Cargo.toml'],
  ['BootForge USB library', 'libs/bootforgeusb/Cargo.toml']
];
let missing = 0;
for (const [label, path] of paths) {
  const ok = existsSync(path);
  console.log(`${ok ? 'READY' : 'MISSING'}  ${label}: ${path}`);
  if (!ok) missing++;
}
process.exit(missing ? 1 : 0);
