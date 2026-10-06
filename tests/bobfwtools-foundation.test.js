import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function readJson(rel) {
  return JSON.parse(read(rel));
}

describe('BobFWTools production foundation', () => {
  it('has one product identity and no Electron desktop stack', () => {
    const pkg = readJson('package.json');
    const tauri = readJson('src-tauri/tauri.conf.json');

    expect(pkg.name).toBe('bobfwtools');
    expect(pkg.version).toBe('0.1.0');
    expect(pkg.devDependencies?.electron).toBeUndefined();
    expect(pkg.devDependencies?.['electron-builder']).toBeUndefined();
    expect(pkg.scripts?.['electron:dev']).toBeUndefined();

    expect(tauri.productName).toBe('BobFWTools');
    expect(tauri.version).toBe('0.1.0');
    expect(tauri.identifier).toBe('com.bobbyblanco.bobfwtools');
  });

  it('ships the App Store sandbox and USB/file entitlements', () => {
    const entitlements = read('src-tauri/entitlements.mac.plist');
    expect(entitlements).toContain('com.apple.security.app-sandbox');
    expect(entitlements).toContain('com.apple.security.device.usb');
    expect(entitlements).toContain('com.apple.security.files.user-selected.read-write');

    const tauri = readJson('src-tauri/tauri.conf.json');
    expect(tauri.bundle?.macOS?.entitlements).toBe('entitlements.mac.plist');
  });

  it('does not bundle legacy Node or Python runtime payloads', () => {
    const tauri = readJson('src-tauri/tauri.conf.json');
    expect(tauri.bundle?.resources ?? []).toEqual([]);
    expect(tauri.bundle?.externalBin).toBeUndefined();
  });

  it('exposes real MTP transfer workflows', () => {
    const mtp = read('src-tauri/src/mtp_backend.rs');
    expect(mtp).toContain('pub async fn mtp_status');
    expect(mtp).toContain('pub async fn mtp_list_root');
    expect(mtp).toContain('pub async fn mtp_upload_file');
    expect(mtp).toContain('pub async fn mtp_download_file');
    expect(mtp).toContain('download_windowed_default');
    expect(mtp).toContain('partial object was removed');
    expect(mtp).toContain('post-list-verification');
  });

  it('exposes only allowlisted ADB workflows to the UI layer', () => {
    const adb = read('src-tauri/src/adb_workflows.rs');
    expect(adb).toContain('pub fn adb_scan');
    expect(adb).toContain('pub fn adb_device_info');
    expect(adb).toContain('pub fn adb_logcat_snapshot');
    expect(adb).toContain('pub fn adb_screenshot');
    expect(adb).toContain('ADB device');
    expect(adb).toContain('is not authorized for workflows');
    expect(adb).not.toMatch(/Command::new\([^)]*user/i);
  });

  it('provides an evidence-backed workflow capability matrix', () => {
    const matrix = read('src-tauri/src/workflow_capabilities.rs');
    for (const id of [
      'mtp-browse',
      'mtp-upload',
      'mtp-download',
      'adb-device-info',
      'adb-logcat',
      'adb-screenshot',
      'adb-battery-info',
      'adb-reboot',
      'adb-network-settings',
      'adb-factory-reset-settings',
      'adb-install-apk',
      'adb-app-manager',
      'fastboot-present',
      'usb-observation',
    ]) {
      expect(matrix).toContain(id);
    }
    expect(matrix).toContain('evidence');
  });

  it('keeps the production reality gate in CI', () => {
    const workflow = read('.github/workflows/bobfwtools-macos.yml');
    expect(workflow).toContain('npm run verify:reality');
    expect(workflow).toContain('cargo check --manifest-path src-tauri/Cargo.toml');
    expect(workflow).toContain('Build universal BobFWTools.app');
  });
});


describe('Diagnose This Phone engine', () => {
  it('aggregates real transports and exposes evidence-backed findings', () => {
    const diagnostics = read('src-tauri/src/diagnostics.rs');
    expect(diagnostics).toContain('pub async fn diagnose_phone');
    expect(diagnostics).toContain('bootforgeusb::scan');
    expect(diagnostics).toContain('adb_scan');
    expect(diagnostics).toContain('mtp_status');
    expect(diagnostics).toContain('fastboot');
    expect(diagnostics).toContain('available_workflows');
    expect(diagnostics).toContain('blocked_workflows');
    expect(diagnostics).toContain('evidence');
  });

  it('exposes the diagnostic command through Tauri and the desktop UI', () => {
    const main = read('src-tauri/src/main.rs');
    const bridge = read('src/lib/desktop.ts');
    const app = read('src/App.tsx');
    expect(main).toContain('diagnose_phone');
    expect(bridge).toContain("invoke<PhoneDiagnosticReport>('diagnose_phone')");
    expect(app).toContain('Diagnose This Phone');
  });
});


describe('USB Cable Doctor diagnostics', () => {
  it('distinguishes Android USB evidence from unrelated USB hardware', () => {
    const diagnostics = read('src-tauri/src/diagnostics.rs');
    expect(diagnostics).toContain('platform_hint.starts_with("android-")');
    expect(diagnostics).toContain('android_usb_devices_seen');
    expect(diagnostics).toContain('connection_grade');
    expect(diagnostics).toContain('connection_summary');
    expect(diagnostics).toContain('usb-only');
    expect(diagnostics).toContain('mtp-only');
    expect(diagnostics).toContain('adb-only');
    expect(diagnostics).toContain('samsung-download-mode');
    expect(diagnostics).toContain('mediatek-preloader');
  });

  it('renders Cable Doctor connection evidence in the desktop UI', () => {
    const app = read('src/App.tsx');
    expect(app).toContain('USB / Cable Doctor');
    expect(app).toContain('diagnostic.usbConnections');
    expect(app).toContain('diagnostic.connectionGrade');
  });
});


describe('auditable workflow job ledger', () => {
  it('allows only explicit one-click workflows and records terminal state', () => {
    const jobs = read('src-tauri/src/workflow_jobs.rs');
    expect(jobs).toContain('const ALLOWED');
    expect(jobs).toContain('workflow_job_start');
    expect(jobs).toContain('workflow_job_list');
    expect(jobs).toContain('workflow_job_get');
    expect(jobs).toContain('state: "running"');
    expect(jobs).toContain('job.state = "completed"');
    expect(jobs).toContain('job.state = "failed"');
    expect(jobs).not.toContain('shell -c');
  });

  it('shows recent one-click jobs in the desktop UI', () => {
    const app = read('src/App.tsx');
    expect(app).toContain('Recent one-click jobs');
    expect(app).toContain('startWorkflowJob');
    expect(app).toContain('workflowJobs');
  });
});


describe('workflow job durability and retries', () => {
  it('persists workflow job history and exposes retry without fake cancellation', () => {
    const jobs = read('src-tauri/src/workflow_jobs.rs');
    expect(jobs).toContain('workflow-jobs.jsonl');
    expect(jobs).toContain('persist_terminal_job');
    expect(jobs).toContain('load_persisted_jobs');
    expect(jobs).toContain('workflow_job_retry');
    expect(jobs).toContain('retry_of');
    expect(jobs).not.toContain('workflow_job_cancel');
  });

  it('renders retry only for terminal jobs', () => {
    const app = read('src/App.tsx');
    expect(app).toContain("job.state !== 'running'");
    expect(app).toContain('retryWorkflowJob');
  });
});
