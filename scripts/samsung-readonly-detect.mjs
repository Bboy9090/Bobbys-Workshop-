#!/usr/bin/env node
/** Samsung Download Mode diagnostic. Only the read-only 'detect' action is permitted. */
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const args=process.argv.slice(2);
const value=(key)=>{const i=args.indexOf(key);return i<0?null:args[i+1];};
if(args.includes('--help')){
 console.log('Usage: node scripts/samsung-readonly-detect.mjs --heimdall /absolute/path/to/heimdall --confirm-readonly');
 process.exit(0);
}
try{
 const executable=value('--heimdall');
 if(!args.includes('--confirm-readonly')||!executable||!executable.startsWith('/')||args.some(a=>a==='flash'||a==='--repartition'))
  throw Error('Absolute Heimdall path and explicit read-only confirmation required');
 const child=spawnSync(resolve(executable),['detect'],{encoding:'utf8',timeout:15000,maxBuffer:65536,env:{PATH:process.env.PATH??''}});
 if(child.error) throw child.error;
 const detected=child.status===0 && /Device detected/.test(child.stdout??'');
 console.log(JSON.stringify({schema:'bobfwtools.samsung.detect.v1',transport:'Samsung Download Mode',
  detected,protocolSessionVerified:false,pitDownloaded:false,modelIdentityVerified:false,
  flashAuthorized:false,frpStateChanged:false,exitCode:child.status},null,2));
 process.exitCode=detected?0:3;
}catch(e){
 console.error('Samsung detection refused: '+(e instanceof Error?e.message:String(e)));
 process.exitCode=2;
}
