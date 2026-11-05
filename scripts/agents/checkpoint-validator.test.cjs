'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { validateCheckpoint } = require('./checkpoint-validator.cjs');
const cases = [
  [
    "valid plan",
    {
      "version": 1,
      "project": "Workshop",
      "task": "handoff",
      "owner": "Codex",
      "timestamp": "2026-10-06T12:49:15Z",
      "source": {
        "repository": "Bboy9090/Bobbys-Workshop-",
        "branch": "test",
        "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      "state": "planned",
      "blockers": [],
      "dependencies": [],
      "nextAction": "Run tests",
      "evidence": []
    },
    true
  ],
  [
    "null",
    null,
    false
  ],
  [
    "missing owner",
    {
      "version": 1,
      "project": "Workshop",
      "task": "handoff",
      "owner": " ",
      "timestamp": "2026-10-06T12:49:15Z",
      "source": {
        "repository": "Bboy9090/Bobbys-Workshop-",
        "branch": "test",
        "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      "state": "planned",
      "blockers": [],
      "dependencies": [],
      "nextAction": "Run tests",
      "evidence": []
    },
    false
  ],
  [
    "short revision",
    {
      "version": 1,
      "project": "Workshop",
      "task": "handoff",
      "owner": "Codex",
      "timestamp": "2026-10-06T12:49:15Z",
      "source": {
        "repository": "Bboy9090/Bobbys-Workshop-",
        "branch": "test",
        "revision": "abcd"
      },
      "state": "planned",
      "blockers": [],
      "dependencies": [],
      "nextAction": "Run tests",
      "evidence": []
    },
    false
  ],
  [
    "invalid date",
    {
      "version": 1,
      "project": "Workshop",
      "task": "handoff",
      "owner": "Codex",
      "timestamp": "2026-02-30T12:00:00Z",
      "source": {
        "repository": "Bboy9090/Bobbys-Workshop-",
        "branch": "test",
        "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      "state": "planned",
      "blockers": [],
      "dependencies": [],
      "nextAction": "Run tests",
      "evidence": []
    },
    false
  ],
  [
    "unsupported state",
    {
      "version": 1,
      "project": "Workshop",
      "task": "handoff",
      "owner": "Codex",
      "timestamp": "2026-10-06T12:49:15Z",
      "source": {
        "repository": "Bboy9090/Bobbys-Workshop-",
        "branch": "test",
        "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      "state": "done",
      "blockers": [],
      "dependencies": [],
      "nextAction": "Run tests",
      "evidence": []
    },
    false
  ],
  [
    "missing blockers",
    {
      "version": 1,
      "project": "Workshop",
      "task": "handoff",
      "owner": "Codex",
      "timestamp": "2026-10-06T12:49:15Z",
      "source": {
        "repository": "Bboy9090/Bobbys-Workshop-",
        "branch": "test",
        "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      "state": "planned",
      "dependencies": [],
      "nextAction": "Run tests",
      "evidence": []
    },
    false
  ],
  [
    "unsupported tested",
    {
      "version": 1,
      "project": "Workshop",
      "task": "handoff",
      "owner": "Codex",
      "timestamp": "2026-10-06T12:49:15Z",
      "source": {
        "repository": "Bboy9090/Bobbys-Workshop-",
        "branch": "test",
        "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      "state": "tested",
      "blockers": [],
      "dependencies": [],
      "nextAction": "Run tests",
      "evidence": []
    },
    false
  ],
  [
    "implemented receipt",
    {
      "version": 1,
      "project": "Workshop",
      "task": "handoff",
      "owner": "Codex",
      "timestamp": "2026-10-06T12:49:15Z",
      "source": {
        "repository": "Bboy9090/Bobbys-Workshop-",
        "branch": "test",
        "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      "state": "implemented",
      "blockers": [],
      "dependencies": [],
      "nextAction": "Run tests",
      "evidence": [
        {
          "kind": "implementation",
          "executor": "contract-test",
          "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "url": "https://example.com/receipt",
          "result": "pass"
        }
      ]
    },
    true
  ],
  [
    "implemented wrong revision",
    {
      "version": 1,
      "project": "Workshop",
      "task": "handoff",
      "owner": "Codex",
      "timestamp": "2026-10-06T12:49:15Z",
      "source": {
        "repository": "Bboy9090/Bobbys-Workshop-",
        "branch": "test",
        "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      "state": "implemented",
      "blockers": [],
      "dependencies": [],
      "nextAction": "Run tests",
      "evidence": [
        {
          "kind": "implementation",
          "executor": "contract-test",
          "revision": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          "url": "https://example.com/receipt",
          "result": "pass"
        }
      ]
    },
    false
  ],
  [
    "implemented failed receipt",
    {
      "version": 1,
      "project": "Workshop",
      "task": "handoff",
      "owner": "Codex",
      "timestamp": "2026-10-06T12:49:15Z",
      "source": {
        "repository": "Bboy9090/Bobbys-Workshop-",
        "branch": "test",
        "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      "state": "implemented",
      "blockers": [],
      "dependencies": [],
      "nextAction": "Run tests",
      "evidence": [
        {
          "kind": "implementation",
          "executor": "contract-test",
          "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "url": "https://example.com/receipt",
          "result": "fail"
        }
      ]
    },
    false
  ],
  [
    "tested receipt",
    {
      "version": 1,
      "project": "Workshop",
      "task": "handoff",
      "owner": "Codex",
      "timestamp": "2026-10-06T12:49:15Z",
      "source": {
        "repository": "Bboy9090/Bobbys-Workshop-",
        "branch": "test",
        "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      "state": "tested",
      "blockers": [],
      "dependencies": [],
      "nextAction": "Run tests",
      "evidence": [
        {
          "kind": "test",
          "executor": "contract-test",
          "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "url": "https://example.com/receipt",
          "result": "pass"
        }
      ]
    },
    true
  ],
  [
    "tested wrong revision",
    {
      "version": 1,
      "project": "Workshop",
      "task": "handoff",
      "owner": "Codex",
      "timestamp": "2026-10-06T12:49:15Z",
      "source": {
        "repository": "Bboy9090/Bobbys-Workshop-",
        "branch": "test",
        "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      "state": "tested",
      "blockers": [],
      "dependencies": [],
      "nextAction": "Run tests",
      "evidence": [
        {
          "kind": "test",
          "executor": "contract-test",
          "revision": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          "url": "https://example.com/receipt",
          "result": "pass"
        }
      ]
    },
    false
  ],
  [
    "tested failed receipt",
    {
      "version": 1,
      "project": "Workshop",
      "task": "handoff",
      "owner": "Codex",
      "timestamp": "2026-10-06T12:49:15Z",
      "source": {
        "repository": "Bboy9090/Bobbys-Workshop-",
        "branch": "test",
        "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      "state": "tested",
      "blockers": [],
      "dependencies": [],
      "nextAction": "Run tests",
      "evidence": [
        {
          "kind": "test",
          "executor": "contract-test",
          "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "url": "https://example.com/receipt",
          "result": "fail"
        }
      ]
    },
    false
  ],
  [
    "deployed receipt",
    {
      "version": 1,
      "project": "Workshop",
      "task": "handoff",
      "owner": "Codex",
      "timestamp": "2026-10-06T12:49:15Z",
      "source": {
        "repository": "Bboy9090/Bobbys-Workshop-",
        "branch": "test",
        "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      "state": "deployed",
      "blockers": [],
      "dependencies": [],
      "nextAction": "Run tests",
      "evidence": [
        {
          "kind": "deployment",
          "executor": "contract-test",
          "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "url": "https://example.com/receipt",
          "result": "pass"
        }
      ]
    },
    true
  ],
  [
    "deployed wrong revision",
    {
      "version": 1,
      "project": "Workshop",
      "task": "handoff",
      "owner": "Codex",
      "timestamp": "2026-10-06T12:49:15Z",
      "source": {
        "repository": "Bboy9090/Bobbys-Workshop-",
        "branch": "test",
        "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      "state": "deployed",
      "blockers": [],
      "dependencies": [],
      "nextAction": "Run tests",
      "evidence": [
        {
          "kind": "deployment",
          "executor": "contract-test",
          "revision": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          "url": "https://example.com/receipt",
          "result": "pass"
        }
      ]
    },
    false
  ],
  [
    "deployed failed receipt",
    {
      "version": 1,
      "project": "Workshop",
      "task": "handoff",
      "owner": "Codex",
      "timestamp": "2026-10-06T12:49:15Z",
      "source": {
        "repository": "Bboy9090/Bobbys-Workshop-",
        "branch": "test",
        "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      "state": "deployed",
      "blockers": [],
      "dependencies": [],
      "nextAction": "Run tests",
      "evidence": [
        {
          "kind": "deployment",
          "executor": "contract-test",
          "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "url": "https://example.com/receipt",
          "result": "fail"
        }
      ]
    },
    false
  ],
  [
    "published receipt",
    {
      "version": 1,
      "project": "Workshop",
      "task": "handoff",
      "owner": "Codex",
      "timestamp": "2026-10-06T12:49:15Z",
      "source": {
        "repository": "Bboy9090/Bobbys-Workshop-",
        "branch": "test",
        "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      "state": "published",
      "blockers": [],
      "dependencies": [],
      "nextAction": "Run tests",
      "evidence": [
        {
          "kind": "publication",
          "executor": "contract-test",
          "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "url": "https://example.com/receipt",
          "result": "pass"
        }
      ]
    },
    true
  ],
  [
    "published wrong revision",
    {
      "version": 1,
      "project": "Workshop",
      "task": "handoff",
      "owner": "Codex",
      "timestamp": "2026-10-06T12:49:15Z",
      "source": {
        "repository": "Bboy9090/Bobbys-Workshop-",
        "branch": "test",
        "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      "state": "published",
      "blockers": [],
      "dependencies": [],
      "nextAction": "Run tests",
      "evidence": [
        {
          "kind": "publication",
          "executor": "contract-test",
          "revision": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          "url": "https://example.com/receipt",
          "result": "pass"
        }
      ]
    },
    false
  ],
  [
    "published failed receipt",
    {
      "version": 1,
      "project": "Workshop",
      "task": "handoff",
      "owner": "Codex",
      "timestamp": "2026-10-06T12:49:15Z",
      "source": {
        "repository": "Bboy9090/Bobbys-Workshop-",
        "branch": "test",
        "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      "state": "published",
      "blockers": [],
      "dependencies": [],
      "nextAction": "Run tests",
      "evidence": [
        {
          "kind": "publication",
          "executor": "contract-test",
          "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "url": "https://example.com/receipt",
          "result": "fail"
        }
      ]
    },
    false
  ],
  [
    "physicallyProven receipt",
    {
      "version": 1,
      "project": "Workshop",
      "task": "handoff",
      "owner": "Codex",
      "timestamp": "2026-10-06T12:49:15Z",
      "source": {
        "repository": "Bboy9090/Bobbys-Workshop-",
        "branch": "test",
        "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      "state": "physicallyProven",
      "blockers": [],
      "dependencies": [],
      "nextAction": "Run tests",
      "evidence": [
        {
          "kind": "hardware",
          "executor": "contract-test",
          "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "url": "https://example.com/receipt",
          "result": "pass"
        }
      ]
    },
    true
  ],
  [
    "physicallyProven wrong revision",
    {
      "version": 1,
      "project": "Workshop",
      "task": "handoff",
      "owner": "Codex",
      "timestamp": "2026-10-06T12:49:15Z",
      "source": {
        "repository": "Bboy9090/Bobbys-Workshop-",
        "branch": "test",
        "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      "state": "physicallyProven",
      "blockers": [],
      "dependencies": [],
      "nextAction": "Run tests",
      "evidence": [
        {
          "kind": "hardware",
          "executor": "contract-test",
          "revision": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          "url": "https://example.com/receipt",
          "result": "pass"
        }
      ]
    },
    false
  ],
  [
    "physicallyProven failed receipt",
    {
      "version": 1,
      "project": "Workshop",
      "task": "handoff",
      "owner": "Codex",
      "timestamp": "2026-10-06T12:49:15Z",
      "source": {
        "repository": "Bboy9090/Bobbys-Workshop-",
        "branch": "test",
        "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      "state": "physicallyProven",
      "blockers": [],
      "dependencies": [],
      "nextAction": "Run tests",
      "evidence": [
        {
          "kind": "hardware",
          "executor": "contract-test",
          "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "url": "https://example.com/receipt",
          "result": "fail"
        }
      ]
    },
    false
  ],
  [
    "credential URL",
    {
      "version": 1,
      "project": "Workshop",
      "task": "handoff",
      "owner": "Codex",
      "timestamp": "2026-10-06T12:49:15Z",
      "source": {
        "repository": "Bboy9090/Bobbys-Workshop-",
        "branch": "test",
        "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      "state": "planned",
      "blockers": [],
      "dependencies": [],
      "nextAction": "Run tests",
      "evidence": [
        {
          "kind": "test",
          "executor": "test",
          "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "url": "https://user:secret@example.com",
          "result": "pass"
        }
      ]
    },
    false
  ]
];
for (const [name, input, expected] of cases) {
  test(name, () => assert.equal(validateCheckpoint(input).valid, expected));
}


const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const base = cases[0][1];
for (const [url, expected] of [
  ['https://example.com/results/success', true],
  ['https://example.com/a b', false],
  ['https://example.com:99999/log', false],
  ['https://example.com/path@revision', true],
  ['http://example.com/log', false],
  ['https://user:password@example.com/log', false],
]) {
  test('URL contract: ' + url, () => {
    const evidence = [{ kind: 'test', executor: 'node', result: 'pass', revision: base.source.revision, url }];
    assert.equal(validateCheckpoint({ ...base, state: 'tested', evidence }).valid, expected);
  });
}

test('CLI valid, invalid, malformed, missing file, and usage exits', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'checkpoint-test-'));
  try {
    const cli = path.join(__dirname, 'validate-checkpoint.cjs');
    const run = args => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
    const file = path.join(directory, 'input.json');
    fs.writeFileSync(file, JSON.stringify(base));
    const valid = run([file]);
    assert.equal(valid.status, 0);
    assert.equal(JSON.parse(valid.stdout).valid, true);
    fs.writeFileSync(file, '{}');
    const invalid = run([file]);
    assert.equal(invalid.status, 1);
    assert.equal(JSON.parse(invalid.stdout).valid, false);
    fs.writeFileSync(file, '{private-input');
    const malformed = run([file]);
    assert.equal(malformed.status, 2);
    assert.equal(malformed.stderr.includes('private-input'), false);
    assert.equal(malformed.stderr.includes(directory), false);
    assert.equal(run([path.join(directory, 'absent')]).status, 2);
    assert.equal(run([]).status, 2);
    assert.equal(run([file, file]).status, 2);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
