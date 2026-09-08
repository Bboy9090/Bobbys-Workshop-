const byId = (id) => document.getElementById(id);
const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

function pill(status = 'UNKNOWN') {
  const safe = String(status).toUpperCase();
  return `<span class="pill ${escapeHtml(safe)}">${escapeHtml(safe.replaceAll('_', ' '))}</span>`;
}

function card(title, status, detail, meta = [], source = '', url = '') {
  const body = `<div class="card"><div class="row"><div><div class="title">${escapeHtml(title)}</div>${detail ? `<div class="detail">${escapeHtml(detail)}</div>` : ''}</div>${pill(status)}</div>${meta.length ? `<div class="meta">${meta.map(escapeHtml).join('<span>•</span>')}</div>` : ''}${source ? `<div class="source">Source: ${escapeHtml(source)}</div>` : ''}</div>`;
  return url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer" style="text-decoration:none">${body}</a>` : body;
}

function formatDate(value) {
  if (!value) return 'date unknown';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
}

function setHtml(id, html) {
  const el = byId(id);
  if (el) el.innerHTML = html;
}

function renderOverview(data) {
  setHtml('activeNow', (data.activeNow || []).map(x => card(x.lane, x.status, x.detail, [], x.source || '')).join('') || '<div class="empty">No active lanes recorded.</div>');

  setHtml('recent', (data.recentVerifiedWork || []).map(x => {
    const title = x.repo ? `${x.repo} · ${x.shortSha || ''}` : (x.type || 'Verified work');
    const detail = x.message || x.detail || x.reason || '';
    const meta = [x.date ? formatDate(x.date) : '', x.ref ? `ref ${x.ref}` : ''].filter(Boolean);
    return card(title, x.status, detail, meta, '', x.url || '');
  }).join('') || '<div class="empty">No verified work returned.</div>');

  const cal = data.thisWeek || { mode: 'UNKNOWN', events: [] };
  setHtml('week', (cal.events || []).map(x => card(x.summary, cal.mode, formatDate(x.start))).join('') || '<div class="empty">No calendar commitments in the current 7-day window.</div>');

  const runtime = data.runtime?.soulCodex;
  const soul = runtime ? card(runtime.service || 'Soul Codex Web', runtime.status, runtime.reason || `${runtime.url || ''}${runtime.httpStatus ? ` · HTTP ${runtime.httpStatus}` : ''}`, [runtime.checkedAt ? `Checked ${formatDate(runtime.checkedAt)}` : ''].filter(Boolean), 'Live HTTP probe', runtime.url || '') : '<div class="empty">Soul Codex runtime evidence unavailable.</div>';
  const arc = data.runtime?.arcwyre;
  const arcCard = arc ? card('ARCWYRE Wave 9', arc.status, arc.reason || `${arc.blockers?.length || 0} unresolved runtime lanes · build ${arc.buildStatus || 'UNKNOWN'}`, [arc.shortSha ? `SHA ${arc.shortSha}` : '', arc.generatedAt ? `Manifest ${formatDate(arc.generatedAt)}` : ''].filter(Boolean), 'AWS CodeBuild → S3 manifest', arc.manifestUrl || '') : '';
  setHtml('runtime', soul + arcCard);
}

function renderEngineering(data) {
  setHtml('engineeringList', (data.engineering || []).map(x => card(x.name, x.status, x.detail, [], x.source || '')).join('') || '<div class="empty">No engineering lanes recorded.</div>');

  const arc = data.runtime?.arcwyre;
  if (!arc) {
    setHtml('arcwyreEvidence', '<div class="empty">ARCWYRE evidence unavailable.</div>');
    setHtml('arcwyreMatrix', '<div class="empty">No matrix available.</div>');
    return;
  }
  const evidence = [
    card('Wave 9 gate', arc.status, arc.releaseCandidate ? 'release_candidate=true' : 'release_candidate=false', [arc.buildStatus ? `Build ${arc.buildStatus}` : '', arc.buildId || ''].filter(Boolean), 'S3 evidence manifest', arc.manifestUrl || ''),
    card('Evidence bundle', arc.status === 'UNKNOWN' ? 'UNKNOWN' : 'PASS', `${arc.evidenceFileCount ?? 'Unknown'} evidence files`, [arc.matrixSha256 ? `Matrix SHA-256 ${arc.matrixSha256}` : '', arc.matrixExitCode !== null && arc.matrixExitCode !== undefined ? `Exit ${arc.matrixExitCode}` : ''].filter(Boolean), 'Stage 2 receipt'),
    card('Physical hardware validation', arc.physicalHardwareValidation ? 'PASS' : 'HOLD', arc.physicalHardwareValidation ? 'Physical hardware evidence exists.' : 'Physical hardware validation is not yet complete.', [], 'Wave 9 manifest')
  ];
  setHtml('arcwyreEvidence', evidence.join(''));

  setHtml('arcwyreMatrix', (arc.gates || []).map(g => card(g.gate, g.cleared ? 'PASS' : (g.harness_status === 'MISSING_HARNESS' ? 'BLOCKER' : 'BLOCKED'), `${g.harness_status || 'UNCLASSIFIED'} · ${g.evidence_status || 'NO_EVIDENCE'}`, g.source_paths || [], 'Wave 9 gate matrix')).join('') || '<div class="empty">No Wave 9 gate rows found.</div>');
}

function renderCreative(data) {
  setHtml('creativeProjects', (data.creativeProjects || []).map(x => card(x.name, x.status, `${x.stage}: ${x.detail}`, [x.sourceTitle || ''].filter(Boolean), 'Google Drive', x.sourceUrl || '')).join('') || '<div class="empty">No creative projects tracked.</div>');

  setHtml('publishing', (data.publishing || []).map(x => `<div class="book"><strong>${escapeHtml(x.book)}</strong><small>Kindle: ${escapeHtml(x.kindle)}</small><small>Paperback: ${escapeHtml(x.paperback)}</small><small>Hardcover: ${escapeHtml(x.hardcover)}</small><small>Wide: ${escapeHtml(x.wide)}</small></div>`).join('') || '<div class="empty">No publishing state recorded.</div>');
}

function renderBlockers(data) {
  setHtml('blockerList', (data.blockers || []).map(x => card(x.lane, x.severity, x.detail, [], x.source || '')).join('') || card('No blockers recorded', 'PASS', 'No evidence-backed blockers are currently listed.'));

  setHtml('dependencies', (data.dependencies || []).map(x => `<div class="card dependency"><div><div class="title">${escapeHtml(x.from)}</div><div class="detail">${escapeHtml(x.detail)}</div></div><div class="arrow">→</div><div><div class="title">${escapeHtml(x.to)}</div>${pill(x.status)}</div></div>`).join('') || '<div class="empty">No dependencies recorded.</div>');
}

function isReady(status) {
  return ['READY', 'LIVE', 'RUNNING', 'APPROVED', 'PASS'].includes(String(status || '').toUpperCase());
}

function renderReadiness(data) {
  const readiness = data.readiness || [];
  setHtml('readyList', readiness.filter(x => isReady(x.status)).map(x => card(x.name, x.status, x.detail)).join('') || '<div class="empty">Nothing is currently verified READY/LIVE.</div>');
  setHtml('notReadyList', readiness.filter(x => !isReady(x.status)).map(x => card(x.name, x.status, x.detail)).join('') || '<div class="empty">No pending readiness lanes.</div>');
}

function renderKpis(data) {
  const arc = data.summary?.arcwyre || {};
  const soul = data.summary?.soulCodex || {};
  const blockers = data.blockers || [];
  const ready = (data.readiness || []).filter(x => isReady(x.status));

  byId('kpiArc').textContent = arc.status || 'UNKNOWN';
  byId('kpiArcMeta').textContent = `${arc.blockers ?? '?'} blocker${arc.blockers === 1 ? '' : 's'} · ${arc.sourceSha ? arc.sourceSha.slice(0, 7) : 'SHA unknown'}`;
  byId('kpiSoul').textContent = soul.status === 'PASS' ? 'RUNNING' : (soul.status || 'UNKNOWN');
  byId('kpiSoulMeta').textContent = soul.deployment?.shortSha ? `Railway ${soul.deployment.shortSha}` : 'Deployment unknown';
  byId('kpiBlockers').textContent = String(blockers.length);
  byId('kpiReady').textContent = String(ready.length);
}

function render(data) {
  renderKpis(data);
  renderOverview(data);
  renderEngineering(data);
  renderCreative(data);
  renderBlockers(data);
  renderReadiness(data);

  const soulOk = data.runtime?.soulCodex?.status === 'PASS';
  const arcKnown = data.runtime?.arcwyre?.status && data.runtime.arcwyre.status !== 'UNKNOWN';
  byId('healthLabel').textContent = soulOk && arcKnown ? 'Core live evidence connected' : 'Evidence partially connected';
  byId('lastUpdated').textContent = `Live refresh: ${formatDate(data.generatedAt)} · Manual/Drive snapshot: ${formatDate(data.manualUpdatedAt)}`;
}

async function load() {
  try {
    const response = await fetch('/api/status', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    render(await response.json());
  } catch (error) {
    byId('healthLabel').textContent = 'Console data unavailable';
    setHtml('blockerList', card('Console API', 'UNKNOWN', String(error.message || error)));
  }
}

for (const btn of document.querySelectorAll('.tab')) {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    byId(btn.dataset.tab)?.classList.add('active');
  });
}

let deferredPrompt;
const installBtn = byId('installBtn');
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  installBtn.classList.add('show');
});
installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = undefined;
  installBtn.classList.remove('show');
});
window.addEventListener('appinstalled', () => installBtn.classList.remove('show'));

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

load();
setInterval(load, 30_000);
