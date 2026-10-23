import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';

const paths=[
  'server/authorization-triggers.js',
  'src-tauri/resources/server/authorization-triggers.js',
  'src-tauri/bundle/resources/server/authorization-triggers.js',
];

describe('Samsung Download Mode evidence contract',()=>{
  it('keeps all packaged authorization backends fail-closed on USB detect alone',()=>{
    for(const path of paths){
      const text=readFileSync(path,'utf8');
      expect(text).toContain("const usbCandidateDetected = detectResult.success && detectResult.stdout.includes('Device detected')");
      expect(text).toContain("heimdall print-pit --no-reboot --verbose");
      expect(text).toContain("const protocolSessionVerified = Boolean(pitResult.success && pitLooksStructured)");
      expect(text).toContain("flashAuthorized: false");
      expect(text).toContain("frpStateChanged: false");
      expect(text).toContain("oemLockStateChanged: false");
      expect(text).toContain("kgStateChanged: false");
      expect(text).toContain("Samsung USB detected, but Download Mode protocol was not verified");
      expect(text).not.toContain("message: 'Samsung device detected in Download Mode'");
    }
  });
});
