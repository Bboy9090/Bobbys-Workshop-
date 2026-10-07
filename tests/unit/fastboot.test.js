import { describe, it, expect, vi, beforeEach } from 'vitest';
const { execSync } = vi.hoisted(() => ({ execSync: vi.fn() }));
vi.mock('child_process', () => ({ execSync }));
import fastboot from '../../src-tauri/resources/core/lib/fastboot.js';
beforeEach(() => execSync.mockReset());
describe('Fastboot read-only contracts', () => {
  it('checks installation using the executor', () => { execSync.mockReturnValue(''); expect(fastboot.isInstalled()).toBe(true); expect(execSync).toHaveBeenCalled(); });
  it('reports unavailable tools', () => { const installed = vi.spyOn(fastboot, 'isInstalled').mockReturnValue(false); try { expect(fastboot.listDevices()).toEqual({ success:false,error:'Fastboot not installed',devices:[] }); expect(execSync).not.toHaveBeenCalled(); } finally { installed.mockRestore(); } });
  it('parses actual device output', () => { execSync.mockReturnValueOnce('').mockReturnValueOnce('serial1\tfastboot\nserial2\tfastboot'); expect(fastboot.listDevices().devices.map(d => d.serial)).toEqual(['serial1','serial2']); });
  it('rejects shell separators before execution', () => { execSync.mockReturnValue(''); expect(fastboot.executeCommand('test','getvar product; echo injected').success).toBe(false); expect(execSync).toHaveBeenCalledTimes(1); });
  it('reports execution failures', () => { execSync.mockReturnValueOnce('').mockImplementationOnce(() => { throw Error('read failed'); }); expect(fastboot.executeCommand('test','getvar product').error).toBe('read failed'); });
});
