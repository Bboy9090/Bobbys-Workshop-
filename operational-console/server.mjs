import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const publicDir = join(root, 'public');
const dataFile = join(root, 'data', 'status.json');
const port = Number(process.env.PORT || 3000);
const ARCWYRE_MANIFEST_URL = process.env.ARCWYRE_MANIFEST_URL || 'https://arcwyre-evidence-960763460596-us-east-1.s3.us-east-1.amazonaws.com/wave9/latest.json';

const json = (res, status, value) => {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(JSON.stringify(value));
};

async function fetchJson(url, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'user-agent': 'Bobbys-Workshop-Operational-Console/2.0' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function latestCommit(repo, ref = null) {
  try {
    const refQuery = ref ? `&sha=${encodeURIComponent(ref)}` : '';
    const commits = await fetchJson(`https://api.github.com/repos/${repo}/commits?per_page=1${refQuery}`);
    const commit = commits?.[0];
    return commit ? {
      status: 'PASS',
      repo,
      ref: ref || 'default',
      sha: commit.sha,
      shortSha: commit.sha.slice(0, 7),
      message: commit.commit?.message?.split('\n')[0] || 'Commit',
      date: commit.commit?.committer?.date || null,
      url: commit.html_url
    } : { status: 'UNKNOWN', repo, ref: ref || 'default', reason: 'No commit returned' };
  } catch (error) {
    return { status: 'UNKNOWN', repo, ref: ref || 'default', reason: String(error.message || error) };
  }
}

async function probeSoulCodex() {
  const base = 'https://soulcodex.up.railway.app';
  const candidates = ['/api/health', '/health', '/'];
  for (const path of candidates) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(base + path, { signal: controller.signal, redirect: 'follow', cache: 'no-store' });
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

async function arcwyreEvidence() {
  try {
    const manifest = await fetchJson(ARCWYRE_MANIFEST_URL, 8000);
    const blockers = Array.isArray(manifest.blockers) ? manifest.blockers : [];
    const gates = Array.isArray(manifest.wave9_matrix?.gates) ? manifest.wave9_matrix.gates : [];
    return {
      status: manifest.wave9_gate || 'UNKNOWN',
      sourceSha: manifest.source_sha || null,
      shortSha: manifest.source_sha?.slice(0, 7) || null,
      generatedAt: manifest.generated_at || null,
      buildId: manifest.build?.id || manifest.stage2_receipt?.executor_run_id || null,
      buildStatus: manifest.build?.status || 'UNKNOWN',
      releaseCandidate: Boolean(manifest.release_candidate),
      physicalHardwareValidation: Boolean(manifest.physical_hardware_validation),
      blockers,
      gates,
      matrixSha256: manifest.stage2_receipt?.matrix_sha256 || null,
      matrixExitCode: manifest.stage2_receipt?.matrix_exit_code ?? null,
      evidenceFileCount: manifest.evidence_file_count ?? null,
      manifestUrl: ARCWYRE_MANIFEST_URL,
      raw: manifest
    };
  } catch (error) {
    return {
      status: 'UNKNOWN',
      blockers: [],
      gates: [],
      manifestUrl: ARCWYRE_MANIFEST_URL,
      reason: String(error.message || error)
    };
  }
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
    const response = await fetch(url, { headers: { 'user-agent': 'Bobbys-Workshop-Operational-Console/2.0' }, cache: 'no-store' });
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

function replaceLane(items, lane, replacement) {
  const rest = (items || []).filter(item => item.lane !== lane);
  return [replacement, ...rest];
}

async function apiStatus() {
  const manual = JSON.parse(await readFile(dataFile, 'utf8'));
  const [soulCodexCommit, arcwyreCommit, soulCodexRuntime, arcwyre, calendar] = await Promise.all([
    latestCommit('Bboy9090/Ultimate-SoulCodex'),
    latestCommit('Bboy9090/bluephoenix-native', 'convergence/wave9-hardening'),
    probeSoulCodex(),
    arcwyreEvidence(),
    calendarEvents(manual.thisWeek)
  ]);

  const arcDetail = arcwyre.status === 'BLOCKED'
    ? `${arcwyre.blockers.length} Wave 9 runtime lanes unresolved · build ${arcwyre.buildStatus || 'UNKNOWN'} · ${arcwyre.shortSha || 'SHA unknown'}`
    : arcwyre.status === 'PASS'
      ? `Wave 9 evidence PASS · ${arcwyre.shortSha || 'SHA unknown'}`
      : `Manifest unavailable: ${arcwyre.reason || 'unknown reason'}`;

  const soulDetail = soulCodexRuntime.status === 'PASS'
    ? `Production HTTP ${soulCodexRuntime.httpStatus} · Railway deployment ${manual.soulCodexDeployment?.shortSha || 'SHA unknown'}`
    : soulCodexRuntime.reason || 'Runtime health unknown';

  let activeNow = replaceLane(manual.activeNow, 'ARCWYRE / Blue Phoenix', {
    lane: 'ARCWYRE / Blue Phoenix',
    status: arcwyre.status,
    detail: arcDetail,
    source: 'AWS evidence manifest'
  });
  activeNow = replaceLane(activeNow, 'Soul Codex Web', {
    lane: 'Soul Codex Web',
    status: soulCodexRuntime.status === 'PASS' ? 'RUNNING' : soulCodexRuntime.status,
    detail: soulDetail,
    source: 'GitHub + Railway + HTTP'
  });

  const arcBlockers = arcwyre.blockers.map(name => {
    const gate = arcwyre.gates.find(g => g.gate === name);
    return {
      lane: `ARCWYRE · ${name}`,
      severity: gate?.harness_status === 'MISSING_HARNESS' ? 'BLOCKER' : 'BLOCKED',
      detail: `${gate?.harness_status || 'UNCLASSIFIED'} · ${gate?.evidence_status || 'NO_EVIDENCE'}`,
      source: 'Wave 9 manifest'
    };
  });

  const readiness = (manual.readiness || []).map(item => {
    if (item.id === 'arcwyre') {
      return {
        ...item,
        status: arcwyre.releaseCandidate ? 'READY' : arcwyre.status,
        detail: arcwyre.releaseCandidate
          ? `Release candidate evidence is true at ${arcwyre.shortSha || 'current SHA'}.`
          : `${arcwyre.blockers.length} runtime lanes remain; release_candidate=false.`
      };
    }
    if (item.id === 'soul-web') {
      return {
        ...item,
        status: soulCodexRuntime.status === 'PASS' ? 'READY' : soulCodexRuntime.status,
        detail: soulCodexRuntime.status === 'PASS'
          ? `Production is reachable; deployed Railway SHA ${manual.soulCodexDeployment?.sha || 'unknown'}.`
          : soulCodexRuntime.reason || 'Production health unavailable.'
      };
    }
    return item;
  });

  return {
    generatedAt: new Date().toISOString(),
    manualUpdatedAt: manual.updatedAt,
    summary: {
      arcwyre: {
        status: arcwyre.status,
        blockers: arcwyre.blockers.length,
        buildStatus: arcwyre.buildStatus,
        sourceSha: arcwyre.sourceSha,
        manifestUrl: arcwyre.manifestUrl,
        matrixSha256: arcwyre.matrixSha256,
        evidenceFileCount: arcwyre.evidenceFileCount
      },
      soulCodex: {
        status: soulCodexRuntime.status,
        deployment: manual.soulCodexDeployment || null,
        runtime: soulCodexRuntime
      }
    },
    activeNow,
    engineering: manual.engineering || [],
    creativeProjects: manual.creativeProjects || [],
    recentVerifiedWork: [
      {
        status: arcwyre.status === 'UNKNOWN' ? 'UNKNOWN' : 'PASS',
        type: 'arcwyre-evidence',
        message: arcwyre.status === 'UNKNOWN'
          ? `ARCWYRE manifest unavailable: ${arcwyre.reason || 'unknown'}`
          : `ARCWYRE Wave 9 manifest: ${arcwyre.status}, ${arcwyre.blockers.length} blockers, matrix ${arcwyre.matrixSha256 || 'hash unavailable'}`,
        date: arcwyre.generatedAt,
        url: arcwyre.manifestUrl
      },
      soulCodexCommit,
      arcwyreCommit,
      ...(manual.recentVerifiedWork || [])
    ],
    runtime: { soulCodex: soulCodexRuntime, arcwyre },
    thisWeek: calendar,
    blockers: [...arcBlockers, ...(manual.blockers || []).filter(x => x.lane !== 'ARCWYRE')],
    dependencies: manual.dependencies || [],
    readiness,
    publishing: manual.publishing || [],
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
      'cache-control': pathname === '/sw.js' ? 'no-cache' : 'public, max-age=120'
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
  console.log(`Operational Console v2 listening on ${port}`);
});
