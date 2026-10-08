#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const checks = [
  ['libs/bootforgeusb/Cargo.toml', 'BootForge USB library'],
  ['src-tauri/Cargo.toml', 'Tauri backend']
];

let failed = false;
for (const [manifest, label] of checks) {
  const result = spawnSync('cargo', ['check', '--manifest-path', manifest], { stdio: 'inherit' });
  if (result.status !== 0) {
    failed = true;
    console.error(`Rust check failed: ${label}`);
  }
}
process.exit(failed ? 1 : 0);
