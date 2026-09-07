const byId = (id) => document.getElementById(id);
const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

function pill(status = 'UNKNOWN') {
  const safe = String(status).toUpperCase();
  return `<span class="pill ${escapeHtml(safe)}">${escapeHtml(safe.replaceAll('_', ' '))}</span>`;
}

function card(title, status, detail, meta = []) {
  return `<div class="card"><div class="row"><div><div class="title">${escapeHtml(title)}</div>${detail ? `<div class="detail">${escapeHtml(detail)}</div>` : ''}</div>${pill(status)}</div>${meta.length ? `<div class="meta">${meta.map(escapeHtml).join('<span>•</span>')}</div>` : ''}</div>`;
}

function formatDate(value) {
  if (!value) return 'date unknown';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
}

function render(data) {
  byId('activeNow').innerHTML = (data.activeNow || []).map(x => card(x.lane, x.status, x.detail)).join('') || '<div class="empty">No active lanes recorded.</div>';

  byId('recent').innerHTML = (data.recentVerifiedWork || []).map(x => {
    const title = x.repo ? `${x.repo} · ${x.shortSha || ''}` : (x.type || 'Verified work');
    const detail = x.message || x.detail || x.reason || '';
    const meta = [x.date || '', x.url ? 'GitHub evidence' : ''].filter(Boolean);
    return x.url ? `<a href="${escapeHtml(x.url)}" target="_blank" rel="noreferrer" style="text-decoration:none">${card(title, x.status, detail, meta)}</a>` : card(title, x.status, detail, meta);
  }).join('') || '<div class="empty">No verified work returned.</div>';

  const cal = data.thisWeek || { mode: 'UNKNOWN', events: [] };
  byId('week').innerHTML = (cal.events || []).map(x => card(x.summary, cal.mode, formatDate(x.start))).join('') || '<div class="empty">No calendar commitments in the current 7-day window.</div>';

  byId('blockers').innerHTML = (data.blockers || []).map(x => card(x.lane, x.severity, x.detail)).join('') || card('No blockers recorded', 'PASS', 'No evidence-backed blockers are currently listed.');

  const runtime = data.runtime?.soulCodex;
  byId('runtime').innerHTML = runtime ? card(runtime.service || 'Soul Codex Web', runtime.status, runtime.reason || `${runtime.url || ''} ${runtime.httpStatus ? `· HTTP ${runtime.httpStatus}` : ''}`, [runtime.checkedAt ? `Checked ${formatDate(runtime.checkedAt)}` : ''].filter(Boolean)) : '<div class="empty">Runtime evidence unavailable.</div>';

  byId('publishing').innerHTML = (data.publishing || []).map(x => `<div class="book"><strong>${escapeHtml(x.book)}</strong><small>Kindle: ${escapeHtml(x.kindle)}</small><small>Paperback: ${escapeHtml(x.paperback)}</small><small>Hardcover: ${escapeHtml(x.hardcover)}</small><small>Wide: ${escapeHtml(x.wide)}</small></div>`).join('') || '<div class="empty">No publishing state recorded.</div>';

  byId('healthLabel').textContent = runtime?.status === 'PASS' ? 'Live evidence connected' : 'Live evidence partially connected';
  byId('lastUpdated').textContent = `Live refresh: ${formatDate(data.generatedAt)} · Manual evidence: ${formatDate(data.manualUpdatedAt)}`;
}

async function load() {
  try {
    const response = await fetch('/api/status', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    render(await response.json());
  } catch (error) {
    byId('healthLabel').textContent = 'Console data unavailable';
    byId('blockers').innerHTML = card('Console API', 'UNKNOWN', String(error.message || error));
  }
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
setInterval(load, 60_000);
