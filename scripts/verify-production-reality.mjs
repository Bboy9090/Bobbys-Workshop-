import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const roots = ['src', 'server', 'src-tauri/src', 'src-tauri/resources/server', 'src-tauri/resources/core'];
const excluded = [
  /(^|\\/)tests?(\\/|$)/i,
  /(^|\\/)__tests__(\\/|$)/i,
  /(^|\\/)fixtures?(\\/|$)/i,
  /(^|\\/)node_modules(\\/|$)/i,
  /(^|\\/)bundle(\\/|$)/i,
  /\\.(md|txt|map|lock)$/i
];

const forbidden = [
  { name: 'placeholder marker', rx: /\\b(TODO|FIXME|STUB)\\b/i },
  { name: 'mock device collection', rx: /\\bmockDevices?\\b/i },
  { name: 'explicit simulated production behavior', rx: /\\b(simulate|simulated|simulation)\\b.{0,80}\\b(device|diagnostic|flash|battery|storage|bootloader|firmware|sensor|network)/i },
  { name: 'demo flash endpoint', rx: /\\/api\\/flash\\/demo\\b/i },
  { name: 'synthetic hardware serial', rx: /\\b(PIXEL6_001|SAMSUNG_S21_002|ONEPLUS_9_003)\\b/ },
  { name: 'randomized hardware telemetry', rx: /Math\\.random\\([^)]*\\).{0,120}\\b(speed|battery|temperature|storage|bootloader|root|signal|health)\\b/i },
  { name: 'randomized hardware telemetry', rx: /\\b(speed|battery|temperature|storage|bootloader|root|signal|health)\\b.{0,120}Math\\.random\\(/i }
];

async function* walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch { return; }
  for (const entry of entries) {
    const p = join(dir, entry.name);
    if (excluded.some((rx) => rx.test(p))) continue;
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.isFile()) yield p;
  }
}

const findings = [];
for (const root of roots) {
  for await (const file of walk(root)) {
    const s = await stat(file);
    if (s.size > 2_000_000) continue;
    let text;
    try { text = await readFile(file, 'utf8'); } catch { continue; }
    const lines = text.split(/\\r?\\n/);
    for (let i = 0; i < lines.length; i++) {
      for (const rule of forbidden) {
        if (rule.rx.test(lines[i])) {
          findings.push({
            file: relative(process.cwd(), file),
            line: i + 1,
            rule: rule.name,
            excerpt: lines[i].trim().slice(0, 220)
          });
        }
      }
    }
  }
}

if (findings.length) {
  console.error('BobFWTools production reality gate: FAILED');
  for (const f of findings) {
    console.error(`- ${f.file}:${f.line} [${f.rule}] ${f.excerpt}`);
  }
  console.error(`Found ${findings.length} production-reality violation(s).`);
  process.exit(1);
}

console.log('BobFWTools production reality gate: PASS');
