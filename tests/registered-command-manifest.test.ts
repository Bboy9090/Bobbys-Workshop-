import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../src-tauri/src/main.rs', import.meta.url), 'utf8');

function namesFromHandler(body: string) {
  const common = new Set<string>();
  const qualified = new Set<string>();
  let qualifiedNext = false;

  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim().replace(/,$/, '');
    if (line === '#[cfg(feature = "qualified-flash")]') {
      qualifiedNext = true;
      continue;
    }
    if (line.startsWith('#[')) {
      qualifiedNext = false;
      continue;
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(line)) {
      (qualifiedNext ? qualified : common).add(line);
      qualifiedNext = false;
    }
  }
  return { common, qualified };
}

function quotedNames(body: string) {
  return new Set([...body.matchAll(/"([A-Za-z_][A-Za-z0-9_]*)"/g)].map((match) => match[1]));
}

describe('native command manifest contract', () => {
  it('matches the actual Tauri handler registry and qualified-flash gate', () => {
    const handler = source.match(
      /\.invoke_handler\(tauri::generate_handler!\[\r?\n(?<body>.*?)\r?\n\s*\]\)\r?\n\s*\.run\(/s,
    );
    const manifest = source.match(
      /fn tauri_get_registered_commands\(\).*?\{\r?\n(?<body>.*?)\r?\n\}/s,
    );

    expect(handler?.groups?.body).toBeTruthy();
    expect(manifest?.groups?.body).toBeTruthy();

    const actual = namesFromHandler(handler!.groups!.body);
    const manifestBody = manifest!.groups!.body;
    const splitAt = manifestBody.indexOf('#[cfg(feature = "qualified-flash")]');

    expect(splitAt).toBeGreaterThan(0);
    const declaredCommon = quotedNames(manifestBody.slice(0, splitAt));
    const declaredQualified = quotedNames(manifestBody.slice(splitAt));

    expect([...declaredCommon].sort()).toEqual([...actual.common].sort());
    expect([...declaredQualified].sort()).toEqual([...actual.qualified].sort());
  });
});
