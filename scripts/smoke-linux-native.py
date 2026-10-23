#!/usr/bin/env python3
"""CI-only AT-SPI observation of our newly extracted native application."""
import datetime
import json
import os
import pathlib
import subprocess
import sys
import time

if os.environ.get('GITHUB_ACTIONS') != 'true' or os.environ.get('RUNNER_OS') != 'Linux':
    raise SystemExit('Disposable Linux CI runner required')
import pyatspi

executable, output = sys.argv[1:]
out = pathlib.Path(output)
env = dict(os.environ, NO_AT_BRIDGE='0', GTK_MODULES='gail:atk-bridge', GTK_A11Y='always')
names = []
with out.with_suffix('.log').open('w') as log:
    app = subprocess.Popen([executable], env=env, stdout=log, stderr=log)
    try:
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline:
            if app.poll() is not None:
                raise RuntimeError(f'Native app exited early: {app.returncode}')
            names = []
            desktop = pyatspi.Registry.getDesktop(0)
            for candidate in desktop:
                if 'bobfwtools' not in (candidate.name or '').lower():
                    continue
                pending = [candidate]
                seen = 0
                while pending and seen < 5000:
                    node = pending.pop()
                    seen += 1
                    try:
                        if node.name:
                            names.append(node.name)
                        # WebKitGTK may expose rendered span/paragraph text through
                        # AccessibleText rather than the accessible name.
                        try:
                            text = node.queryText()
                            value = text.getText(0, min(text.characterCount, 2000)).strip()
                            if value and value not in names:
                                names.append(value)
                        except Exception:
                            # Most containers do not implement AccessibleText.
                            pass
                        pending.extend(list(node))
                    except Exception:
                        continue
            if 'Phone' in names and 'Diagnostics' in names and 'Device checks complete' in names:
                break
            time.sleep(0.5)
        scan_complete = 'Device checks complete' in names
        host_storage_as_phone = 'Connected phones' in names or 'MTP connection observed' in names
        passed = ('Phone' in names and 'Diagnostics' in names and
                  'Desktop connected' in names and scan_complete and not host_storage_as_phone)
        report = {'status': 'PASS' if passed else 'FAIL', 'observedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'scope': 'Linux CI native WebKitGTK under Xvfb; Debian-extracted application', 'navigationNames': names, 'deviceScanComplete': scan_complete, 'noPhoneOnDisposableRunner': not host_storage_as_phone, 'hardwareQualified': False, 'releaseQualified': False, 'executionAuthorized': False}
        out.write_text(json.dumps(report, indent=2) + '\n')
        print('NATIVE_GUI_EVIDENCE ' + json.dumps(report), flush=True)
        if not passed:
            raise RuntimeError('Native WebKitGTK scan/navigation failed or host storage was exposed as a phone')
    finally:
        if app.poll() is None:
            app.terminate()
            try:
                app.wait(timeout=10)
            except subprocess.TimeoutExpired:
                app.kill()
                app.wait(timeout=10)
