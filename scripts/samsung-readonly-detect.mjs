#!/usr/bin/env node
/** Samsung USB / Download Mode read-only evidence helper.
 *  - 'detect' proves only that Heimdall can see a Samsung-compatible USB target.
 *  - '--verify-protocol' additionally performs a read-only PIT request with --no-reboot.
 *  Neither path authorizes flashing or changes FRP/OEM/KG state.
 */
import {spawnSync} from 'node:child_process';
import {isAbsolute,resolve} from 'node:path';

const args=process.argv.slice(2);
const value=(key)=>{const i=args.indexOf(key);return i<0?null:args[i+1];};

if(args.includes('--help')){
 console.log('Usage: node scripts/samsung-readonly-detect.mjs --heimdall /absolute/path/to/heimdall --confirm-readonly [--verify-protocol]');
 process.exit(0);
}

const refusedActions=['flash','--repartition','close-pc-screen'];
const run=(executable,commandArgs)=>spawnSync(resolve(executable),commandArgs,{
 encoding:'utf8',
 timeout:20000,
 maxBuffer:262144,
 env:{PATH:process.env.PATH??''},
});

try{
 const executable=value('--heimdall');
 if(!args.includes('--confirm-readonly')||!executable||!isAbsolute(executable)||args.some(a=>refusedActions.includes(a)))
  throw Error('Absolute Heimdall path and explicit read-only confirmation required');

 const detectedRun=run(executable,['detect']);
 if(detectedRun.error) throw detectedRun.error;
 const detected=detectedRun.status===0 && /Device detected/.test(detectedRun.stdout??'');

 let protocolSessionVerified=false;
 let pitDownloaded=false;
 let protocolExitCode=null;
 let pitEvidenceBytes=0;

 if(detected && args.includes('--verify-protocol')){
   const protocolRun=run(executable,['print-pit','--no-reboot','--stdout-errors']);
   if(protocolRun.error) throw protocolRun.error;
   protocolExitCode=protocolRun.status;
   const combined=((protocolRun.stdout??'')+'\n'+(protocolRun.stderr??'')).trim();
   pitEvidenceBytes=Buffer.byteLength(combined);
   const pitLooksStructured=/PIT|Partition|Binary Type|Device Type|Identifier/i.test(combined);
   protocolSessionVerified=protocolRun.status===0 && pitLooksStructured;
   pitDownloaded=protocolSessionVerified;
 }

 console.log(JSON.stringify({
   schema:'bobfwtools.samsung.readonly.v2',
   transportCandidate:'samsung-usb',
   detected,
   downloadModeQualified:protocolSessionVerified,
   protocolSessionVerified,
   pitDownloaded,
   modelIdentityVerified:false,
   flashAuthorized:false,
   frpStateChanged:false,
   oemLockStateChanged:false,
   kgStateChanged:false,
   detectExitCode:detectedRun.status,
   protocolExitCode,
   pitEvidenceBytes,
 },null,2));

 process.exitCode=detected ? (args.includes('--verify-protocol') && !protocolSessionVerified ? 4 : 0) : 3;
}catch(e){
 console.error('Samsung detection refused: '+(e instanceof Error?e.message:String(e)));
 process.exitCode=2;
}
