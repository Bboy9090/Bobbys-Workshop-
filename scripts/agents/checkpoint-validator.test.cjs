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
