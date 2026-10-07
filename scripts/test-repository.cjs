'use strict';
// Run integration tests against the actual packaged API, without a separately managed server.
const { spawn } = require('node:child_process');
const { createServer } = require('node:net');
const { mkdtempSync, openSync, closeSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { once } = require('node:events');
const root = resolve(__dirname, '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function availablePort() {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  return port;
}
async function main() {
  const port = await availablePort();
  const base = `http://127.0.0.1:${port}`;
  const temp = mkdtempSync(join(tmpdir(), 'workshop-tests-'));
  const logPath = join(temp, 'api.log');
  const log = openSync(logPath, 'w');
  const server = spawn(process.execPath, ['src-tauri/resources/server/index.js'], {
    cwd: root, env: { ...process.env, PORT: String(port), NODE_ENV: 'test' },
    stdio: ['ignore', log, log]
  });
  closeSync(log);
  let tests;
  const stop = () => { tests?.kill('SIGTERM'); server.kill('SIGTERM'); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    let ready = false;
    for (let attempt = 0; attempt < 600; attempt++) {
      if (server.exitCode !== null) break;
      try {
        const response = await fetch(base + '/api/v1/health', { signal: AbortSignal.timeout(500) });
        ready = response.ok && (await response.json()).ok === true;
        if (ready) break;
      } catch { /* Startup polling is bounded; failure is reported below. */ }
      await delay(100);
    }
    if (!ready) throw new Error('Packaged API failed to start. Run npm ci --prefix src-tauri/resources/server.');
    tests = spawn(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...process.argv.slice(2)], {
      cwd: root, env: { ...process.env, API_BASE_URL: base, TEST_API_URL: base }, stdio: 'inherit'
    });
    const [code] = await once(tests, 'exit');
    process.exitCode = code ?? 1;
  } catch (error) {
    console.error(readFileSync(logPath, 'utf8'));
    throw error;
  } finally {
    stop();
    if (server.exitCode === null) {
      const exited = once(server, 'exit');
      const timer = setTimeout(() => server.kill('SIGKILL'), 2000);
      await exited;
      clearTimeout(timer);
    }
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    rmSync(temp, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
