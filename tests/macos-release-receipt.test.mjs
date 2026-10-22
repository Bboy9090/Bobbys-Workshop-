// Test-only command fixtures exercise failure handling. They are not macOS,
// signing, notarization, installer, GUI, or hardware qualification evidence.
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const temporary = [];
const revision = 'a'.repeat(40);
const root = resolve(import.meta.dirname, '..');
afterEach(() => { for (const dir of temporary.splice(0)) rmSync(dir, {recursive:true, force:true}); });
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'bobfw-release-test-'));
  temporary.push(dir);
  const app = join(dir, 'BobFWTools.app');
  const bin = join(app, 'Contents/MacOS/bobfwtools');
  const plist = join(app, 'Contents/Info.plist');
  mkdirSync(join(app, 'Contents/MacOS'), {recursive:true});
  writeFileSync(bin, 'SIMULATED-EXECUTABLE\n'+revision);
  writeFileSync(plist, 'SIMULATED-PLIST');
  const dmg = join(dir, 'fixture.dmg');
  writeFileSync(dmg, 'SIMULATED-DMG');
  const notaries = ['app','dmg'].map(name => {
    const path = join(dir, name+'-notary.json');
    writeFileSync(path, JSON.stringify({status:'Accepted',id:'simulated-'+name}));
    return path;
  });
  const tools = join(dir, 'tools');
  mkdirSync(tools);
  for (const command of ['codesign','spctl','xcrun','lipo']) {
    writeFileSync(join(tools, command), `#!/usr/bin/env bash
set -eu
command=${command}
if [[ "\${SIM_FAIL:-}" == "$command" ]]; then
  [[ -n "\${SIM_FAIL_TARGET:-}" ]] || exit 1
  for arg in "$@"; do [[ "$arg" != *"$SIM_FAIL_TARGET" ]] || exit 1; done
fi
if [[ "$command" == lipo ]]; then printf '%s\\n' "\${SIM_ARCHS:-x86_64 arm64}"; fi
if [[ "$command" == codesign && "$1" == -dv ]]; then
  target="\${@: -1}"
  team="\${SIM_TEAM:-TESTTEAM01}"
  [[ "$target" != *.dmg ]] || team="\${SIM_DMG_TEAM:-TESTTEAM01}"
  printf '%s\\n' 'Authority=Developer ID Application: SIMULATED' "TeamIdentifier=$team" 'Identifier=com.bobbyblanco.bobfwtools'
  if [[ "\${SIM_RUNTIME:-}" != no ]]; then echo 'flags=0x10000(runtime)'; else echo 'flags=0x0(none)'; fi
  if [[ "\${SIM_TIMESTAMP:-}" != no ]]; then echo 'Timestamp=SIMULATED'; fi
fi
exit 0
`, {mode:0o755});
  }
  const output = join(dir, 'receipt.json');
  const env = {...process.env, PATH:tools+':'+process.env.PATH,
    BOBFWTOOLS_SOURCE_REVISION:revision, BOBFWTOOLS_RELEASE_LABEL:'test-only',
    BOBFW_EXPECTED_TEAM_ID:'TESTTEAM01'};
  const run = (overrides={}) => spawnSync('bash', ['scripts/create-bobfwtools-release-receipt.sh',
    app,dmg,...notaries,output], {cwd:root,env:{...env,...overrides},encoding:'utf8'});
  return {dir,app,bin,plist,dmg,notaries,output,env,run};
}
const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex');

describe('release receipt failure handling with simulated command results', () => {
  it('binds both notarization receipts and actual file hashes without promoting native or hardware qualification', () => {
    const f = fixture();
    const result = f.run();
    expect(result.status, result.stderr).toBe(0);
    const receipt = JSON.parse(readFileSync(f.output));
    expect(receipt.schema).toBe('com.bobbyblanco.bobfwtools.release-receipt.v2');
    expect(receipt.sourceRevision).toBe(revision);
    expect(receipt.architectures.sort()).toEqual(['arm64','x86_64']);
    expect(receipt.notarization.app.receiptSha256).toBe(digest(f.notaries[0]));
    expect(receipt.notarization.dmg.receiptSha256).toBe(digest(f.notaries[1]));
    expect(receipt.artifacts).toEqual({executableSha256:digest(f.bin),infoPlistSha256:digest(f.plist),dmgSha256:digest(f.dmg)});
    expect(receipt).toMatchObject({qualifiedDestructiveWriterIncluded:false,hardwareQualified:false,
      executionAuthorized:false,releaseQualified:false,nativeGuiStatus:'NOT TESTED'});
  });
  it.each(['app','dmg'])('rejects rejected %s notarization even if command fixtures would accept it', name => {
    const f = fixture();
    writeFileSync(f.notaries[name==='app' ? 0 : 1], JSON.stringify({status:'Invalid',id:'simulated'}));
    expect(f.run().status).not.toBe(0);
  });
  it('rejects an empty notarization submission id', () => {
    const f=fixture();
    writeFileSync(f.notaries[1], JSON.stringify({status:'Accepted',id:'  '}));
    expect(f.run().status).not.toBe(0);
  });
  it.each([
    {SIM_ARCHS:'arm64'}, {SIM_TEAM:'OTHERTEAM1'}, {SIM_DMG_TEAM:'OTHERTEAM1'},
    {SIM_RUNTIME:'no'}, {SIM_TIMESTAMP:'no'}, {SIM_FAIL:'codesign'},
    {SIM_FAIL:'xcrun'}, {SIM_FAIL:'spctl',SIM_FAIL_TARGET:'.dmg'},
    {SIM_FAIL:'spctl',SIM_FAIL_TARGET:'.app'}, {BOBFWTOOLS_SOURCE_REVISION:'short'},
  ])('fails closed for missing or rejected source/signing prerequisites: %j', env => {
    const f=fixture();
    expect(f.run(env).status).not.toBe(0);
  });
  it.each(['wrong-source','bootforge_qualified_fastboot_devices','issue-qualified-flash-grant'])('rejects an ineligible public binary: %s', marker => {
    const f=fixture();
    writeFileSync(f.bin, marker==='wrong-source' ? 'NO-SOURCE-BINDING' : revision+'\n'+marker);
    const result=f.run();
    expect(result.status).not.toBe(0);
    const packaging=spawnSync('bash',['scripts/package-bobfwtools-dmg.sh',f.app,join(f.dir,'new.dmg'),join(f.dir,'copied.app')],
      {cwd:root,env:f.env,encoding:'utf8'});
    expect(packaging.status).not.toBe(0);
    expect(packaging.stderr).toMatch(/expected source SHA|qualified destructive executor marker/);
  });
  it('refuses to overwrite an existing installer or app destination before mounting anything', () => {
    const f=fixture();
    for(const [dmg,copied] of [[f.dmg,join(f.dir,'new.app')],[join(f.dir,'new.dmg'),f.app]]) {
      const result=spawnSync('bash',['scripts/package-bobfwtools-dmg.sh',f.app,dmg,copied],{cwd:root,env:f.env,encoding:'utf8'});
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('destination already exists');
    }
    expect(readFileSync(f.dmg,'utf8')).toBe('SIMULATED-DMG');
  });
});
