import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const publicDir = join(root, 'public');
const dataFile = join(root, 'data', 'status.json');
const port = Number(process.env.PORT || 3000);

const json = (res, status, value) => {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(JSON.stringify(value));
};

async function fetchJson(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'Bobbys-Workshop-Operational-Console/1.0' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function latestCommit(repo) {
  try {
    const commits = await fetchJson(`https://api.github.com/repos/${repo}/commits?per_page=1`);
    const commit = commits?.[0];
    return commit ? {
      status: 'PASS',
      repo,
      sha: commit.sha,
      shortSha: commit.sha.slice(0, 7),
      message: commit.commit?.message?.split('\n')[0] || 'Commit',
      date: commit.commit?.committer?.date || null,
      url: commit.html_url
    } : { status: 'UNKNOWN', repo, reason: 'No commit returned' };
  } catch (error) {
    return { status: 'UNKNOWN', repo, reason: String(error.message || error) };
  }
}

async function probeSoulCodex() {
  const base = 'https://soulcodex.up.railway.app';
  const candidates = ['/health', '/api/health', '/'];
  for (const path of candidates) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(base + path, { signal: controller.signal, redirect: 'follow' });
      clearTimeout(timer);
      if (response.status >= 200 && response.status < 500) {
        return {
          status: response.ok ? 'PASS' : 'WARN',
          service: 'Soul Codex Web',
          url: base,
          endpoint: path,
          httpStatus: response.status,
          checkedAt: new Date().toISOString()
        };
      }
    } catch {
      clearTimeout(timer);
    }
  }
  return {
    status: 'UNKNOWN',
    service: 'Soul Codex Web',
    url: base,
    checkedAt: new Date().toISOString(),
    reason: 'No public health response'
  };
}

function unfoldIcs(text) {
  return text.replace(/\r?\n[ \t]/g, '');
}

function parseIcsDate(value) {
  if (!value) return null;
  const cleaned = value.replace(/^.*:/, '');
  if (/^\d{8}T\d{6}Z$/.test(cleaned)) {
    return new Date(`${cleaned.slice(0,4)}-${cleaned.slice(4,6)}-${cleaned.slice(6,8)}T${cleaned.slice(9,11)}:${cleaned.slice(11,13)}:${cleaned.slice(13,15)}Z`);
  }
  if (/^\d{8}T\d{6}$/.test(cleaned)) {
    return new Date(`${cleaned.slice(0,4)}-${cleaned.slice(4,6)}-${cleaned.slice(6,8)}T${cleaned.slice(9,11)}:${cleaned.slice(11,13)}:${cleaned.slice(13,15)}`);
  }
  if (/^\d{8}$/.test(cleaned)) {
    return new Date(`${cleaned.slice(0,4)}-${cleaned.slice(4,6)}-${cleaned.slice(6,8)}T00:00:00`);
  }
  return null;
}

async function calendarEvents(fallback) {
  const url = process.env.CALENDAR_ICS_URL;
  if (!url) return { mode: 'SNAPSHOT', events: fallback || [] };
  try {
    const response = await fetch(url, { headers: { 'user-agent': 'Bobbys-Workshop-Operational-Console/1.0' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = unfoldIcs(await response.text());
    const now = Date.now();
    const horizon = now + 7 * 24 * 60 * 60 * 1000;
    const events = [];
    for (const block of text.split('BEGIN:VEVENT').slice(1)) {
      const summary = block.match(/\nSUMMARY:(.*)/)?.[1]?.trim();
      const dtstartLine = block.match(/\nDTSTART[^\n]*/)?.[0]?.trim();
      const start = parseIcsDate(dtstartLine);
      if (!summary || !start) continue;
      const t = start.getTime();
      if (t >= now && t <= horizon) events.push({ summary, start: start.toISOString() });
    }
    events.sort((a, b) => new Date(a.start) - new Date(b.start));
    return { mode: 'LIVE_ICS', events: events.slice(0, 10) };
  } catch (error) {
    return { mode: 'SNAPSHOT_FALLBACK', reason: String(error.message || error), events: fallback || [] };
  }
}

async function apiStatus() {
  const manual = JSON.parse(await readFile(dataFile, 'utf8'));
  const [soulCodexCommit, arcwyreCommit, soulCodexRuntime, calendar] = await Promise.all([
    latestCommit('Bboy9090/Ultimate-SoulCodex'),
    latestCommit('Bboy9090/bluephoenix-native'),
    probeSoulCodex(),
    calendarEvents(manual.thisWeek)
  ]);
  return {
    generatedAt: new Date().toISOString(),
    manualUpdatedAt: manual.updatedAt,
    activeNow: manual.activeNow,
    recentVerifiedWork: [soulCodexCommit, arcwyreCommit, ...(manual.recentVerifiedWork || [])],
    runtime: { soulCodex: soulCodexRuntime },
    thisWeek: calendar,
    blockers: manual.blockers,
    publishing: manual.publishing,
    notes: manual.notes || []
  };
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

async function serveStatic(req, res) {
  let pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/') pathname = '/index.html';
  const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const file = join(publicDir, safe);
  if (!file.startsWith(publicDir)) return false;
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': mime[extname(file)] || 'application/octet-stream',
      'cache-control': pathname === '/sw.js' ? 'no-cache' : 'public, max-age=300'
    });
    res.end(body);
    return true;
  } catch {
    return false;
  }
}

http.createServer(async (req, res) => {
  try {
    if (req.url?.startsWith('/api/status')) return json(res, 200, await apiStatus());
    if (req.url?.startsWith('/api/health')) return json(res, 200, { ok: true, time: new Date().toISOString() });
    if (await serveStatic(req, res)) return;
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  } catch (error) {
    json(res, 500, { error: String(error.message || error) });
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`Operational Console listening on ${port}`);
});
