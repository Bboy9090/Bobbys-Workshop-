#!/usr/bin/env node
import {copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {basename, join, resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {inspectStandardExecutable, packageKinds, requirePackageSet} from './lib/platform-package-evidence.mjs';

const [platform, output] = process.argv.slice(2);
const revision = process.env.BOBFWTOOLS_SOURCE_REVISION;
const root = resolve(import.meta.dirname, '..');
const out = resolve(output ?? '');
const run = (command, args, options = {}) => execFileSync(command, args, {cwd:root, encoding:'utf8', timeout:180000, stdio:['ignore','pipe','pipe'], ...options});
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

if (!packageKinds[platform] || (platform === 'windows' ? process.platform !== 'win32' : process.platform !== 'linux')) throw new Error('Native runner for requested platform required');
if (!output || existsSync(out)) throw new Error('A new isolated evidence directory is required');
if (!/^[a-f0-9]{40}$/.test(revision ?? '') || run('git', ['rev-parse','HEAD']).trim() !== revision) throw new Error('Source revision must equal executor HEAD');
run('git', ['diff','--exit-code','HEAD','--']);
mkdirSync(out, {recursive:true});

try {
  const artifacts = packageKinds[platform].map(kind => {
    const folder = join(root, 'src-tauri/target/release/bundle', kind);
    const extension = {msi:'.msi',nsis:'.exe',appimage:'.AppImage',deb:'.deb'}[kind];
    const files = readdirSync(folder).filter(name => name.endsWith(extension));
    if (files.length !== 1) throw new Error(`Expected exactly one ${kind} installer`);
    const source = join(folder, files[0]);
    if (!lstatSync(source).isFile() || lstatSync(source).isSymbolicLink()) throw new Error('Installer must be a regular file');
    const bytes = readFileSync(source);
    copyFileSync(source, join(out, files[0]));
    return {kind, path:files[0], sha256:digest(bytes), bytes:bytes.length};
  });
  requirePackageSet(platform, artifacts);
  const built = join(root, 'src-tauri/target/release', platform === 'windows' ? 'bobfwtools.exe' : 'bobfwtools');
  const executables = [{location:'build', ...inspectStandardExecutable(readFileSync(built), revision, platform)}];
  const checks = [{capability:'Source-bound standard executable and x86_64 architecture',status:'PASS'}];
  let smoke;
  if (platform === 'windows') {
    run('pwsh', ['-NoProfile','-File','scripts/qualify-windows-installers.ps1','-MsiPath',join(out,artifacts.find(a=>a.kind==='msi').path),'-NsisPath',join(out,artifacts.find(a=>a.kind==='nsis').path),'-OutputDirectory',out]);
    smoke = JSON.parse(readFileSync(join(out,'native-smoke.json'),'utf8'));
    for (const item of smoke.executables) executables.push({location:item.location,...inspectStandardExecutable(readFileSync(item.path),revision,platform)});
    checks.push({capability:'MSI administrative extraction and executable provenance',status:'PASS'},
      {capability:'NSIS isolated current-user installation and executable provenance',status:'PASS'});
  } else {
    const deb = join(out, artifacts.find(a=>a.kind==='deb').path);
    const debRoot = join(out,'deb-copy');
    mkdirSync(debRoot);
    writeFileSync(join(out,'deb-metadata.txt'),run('dpkg-deb',['--info',deb]));
    run('dpkg-deb',['--extract',deb,debRoot]);
    const executable = join(debRoot,'usr/bin/bobfwtools');
    executables.push({location:'deb-copy',...inspectStandardExecutable(readFileSync(executable),revision,platform)});
    const imageRoot = join(out,'appimage-copy');
    mkdirSync(imageRoot);
    const image = join(out, artifacts.find(a=>a.kind==='appimage').path);
    // An artifact transfer need not preserve POSIX permissions. Restore only our
    // new CI copy's owner execute bit; never disable a runtime sandbox.
    run('chmod',['u+x',image]);
    run(image,['--appimage-extract'],{cwd:imageRoot});
    executables.push({location:'appimage-copy',...inspectStandardExecutable(readFileSync(join(imageRoot,'squashfs-root/usr/bin/bobfwtools')),revision,platform)});
    // Start Xvfb first so the D-Bus daemon and any portal services inherit DISPLAY.
    run('xvfb-run',['-a','dbus-run-session','--','/usr/bin/python3','scripts/smoke-linux-native.py',executable,join(out,'native-smoke.json')]);
    smoke = JSON.parse(readFileSync(join(out,'native-smoke.json'),'utf8'));
    checks.push({capability:'Debian package extraction and executable provenance',status:'PASS'},
      {capability:'AppImage extraction and executable provenance',status:'PASS'});
  }
  const nativeUiObserved = platform === 'windows' ? smoke?.nativeWebViewObserved === true : smoke?.nativeNavigationObserved === true;
  if (smoke?.status !== 'PASS' || smoke?.executionAuthorized !== false ||
      smoke?.noPhoneOnDisposableRunner !== true || !nativeUiObserved) {
    throw new Error('Native GUI launch/navigation failed safely or a host disk was exposed as a phone');
  }
  const nativeSmoke = {path:'native-smoke.json',sha256:digest(readFileSync(join(out,'native-smoke.json')))};
  checks.push({capability:'Native CI GUI launch/navigation and host-storage exclusion',status:'PASS'},
    {capability:'Device scan completion observable in hosted accessibility tree',status:smoke?.deviceScanComplete === true ? 'PASS' : 'BLOCKED'},
    {capability:platform === 'windows' ? 'Authenticode release signing' : 'Release checksum signature and trusted publication',status:'BLOCKED'},
    {capability:platform === 'windows' ? 'SmartScreen assessment on supported user Windows host' : 'Installation on supported physical Linux host',status:'NOT TESTED'},
    {capability:'ARM64 native package and GUI qualification',status:'NOT TESTED'},
    {capability:'Physical target protocol and firmware compatibility',status:'BLOCKED'});
  const observedAt = new Date().toISOString();
  const receipt = {schema:'bobfwtools.platform-installer-evidence.v1',sourceRevision:revision,observedAt,
    platform,scope:'Disposable native GitHub CI runner; standard unsigned packages only',
    runner:{os:process.platform,architecture:process.arch,runId:process.env.GITHUB_RUN_ID ?? null,runAttempt:process.env.GITHUB_RUN_ATTEMPT ?? null},
    status:'PASS',artifacts,executables,nativeSmoke,checks,nativeGuiStatus:'PASS (CI only)',
    qualifiedDestructiveWriterIncluded:false,hardwareQualified:false,releaseQualified:false,executionAuthorized:false,cases:[],receipts:[]};
  checks.forEach((check,index) => {
    const spec={caseId:`${platform}-package-${index+1}`,model:`${platform}-x86_64`,deviceAlias:`github-${platform}-ci`,protocol:'installer',operation:check.capability,scope:'release',sourceRevision:revision};
    if(check.status==='BLOCKED')spec.exception='Outside unsigned native CI qualification: '+check.capability;
    receipt.cases.push(spec);
    if(check.status==='PASS')receipt.receipts.push({...spec,status:'PASS',observedAt,detail:check.capability+'; no public release or hardware authority.',artifacts:[...artifacts.map(({path,sha256})=>({path,sha256})),nativeSmoke]});
  });
  writeFileSync(join(out,'installer-evidence.json'),JSON.stringify(receipt,null,2)+'\n');
  writeFileSync(join(out,'installer-matrix.json'),run(process.execPath,['scripts/qualification-matrix.mjs',join(out,'installer-evidence.json')]));
  writeFileSync(join(out,'installer-matrix.md'),run(process.execPath,['scripts/qualification-matrix.mjs',join(out,'installer-evidence.json'),'markdown']));
  console.log(JSON.stringify(receipt,null,2));
} catch (error) {
  writeFileSync(join(out,'qualification-failure.json'),JSON.stringify({status:'FAIL',sourceRevision:revision,observedAt:new Date().toISOString(),platform,error:String(error),stderr:error.stderr?.toString().slice(-6000),executionAuthorized:false,hardwareQualified:false,releaseQualified:false},null,2)+'\n');
  throw error;
}
