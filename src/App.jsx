import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, Terminal, Usb, Zap, HardDrive, Cpu, Unlock, Fingerprint, Activity } from 'lucide-react';

export default function PhoenixDashboard() {
  const [devices, setDevices] = useState([]);
  const [securityStatus, setSecurityStatus] = useState('UNVERIFIED'); // UNVERIFIED, SECURE, VULNERABLE
  const [authStatus, setAuthStatus] = useState('NOT_REQUIRED'); // NOT_REQUIRED, REQUIRED, AUTHORIZED
  const [glitchStatus, setGlitchStatus] = useState('NOT_REQUIRED'); // NOT_REQUIRED, REQUIRED, UNLOCKED
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isGlitching, setIsGlitching] = useState(false);
  const [logs, setLogs] = useState(['[SYSTEM] Phoenix Forge UI Initialized. Awaiting hardware...']);
  const [isPolling, setIsPolling] = useState(true);
  const [isOffensiveMode, setIsOffensiveMode] = useState(false);

  // 1. The Hardware Pulse (Polling the Rust/Python Backend)
  useEffect(() => {
    if (!isPolling) return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:8000/api/devices/scan');
        if (res.ok) {
          const data = await res.json();
          const detectedDevices = data.devices || [];
          setDevices(detectedDevices);

          // 1a. Detect Qualcomm Auth status
          const needsAuth = detectedDevices.some(d => d.protocol && d.protocol.includes('Auth'));
          if (needsAuth && authStatus === 'NOT_REQUIRED') {
            setAuthStatus('REQUIRED');
            setLogs(prev => [...prev.slice(-50), `[!] HANDSHAKE ALERT: Silicon RSA-3072 signature required for ${detectedDevices[0].name}.`]);
          } else if (!needsAuth && authStatus !== 'AUTHORIZED') {
            setAuthStatus('NOT_REQUIRED');
          }

          // 1b. Detect MediaTek Glitch status
          const needsGlitch = detectedDevices.some(d => d.protocol && d.protocol.includes('Locked'));
          if (needsGlitch && glitchStatus === 'NOT_REQUIRED') {
            setGlitchStatus('REQUIRED');
            setLogs(prev => [...prev.slice(-50), `[🔥] EXPLOIT ALERT: MediaTek Secure Boot V3 detected. Glitch required.`]);
          } else if (!needsGlitch && glitchStatus !== 'UNLOCKED') {
            setGlitchStatus('NOT_REQUIRED');
          }
        }
      } catch (err) {
        if (!logs.some(l => l.includes('Backend connection lost'))) {
            setLogs(prev => [...prev.slice(-50), `[ERROR] Backend connection lost: ${err.message}`]);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isPolling, logs, authStatus, glitchStatus]);

  // 2. The Safety Net (Executing Shadow Rollback)
  const triggerShadowRollback = async (deviceId) => {
    setLogs(prev => [...prev, `[🛡️] Initiating Shadow Rollback for ${deviceId}...`]);
    try {
      const res = await fetch('http://localhost:8000/api/security/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, partitions: ['efs', 'nvram', 'seccfg'] })
      });
      
      const data = await res.json();
      if (data.status === 'secure') {
        setSecurityStatus('SECURE');
        setLogs(prev => [...prev, `[+] SUCCESS: Partitions (EFS, NVRAM, SECCFG) secured. Write access GRANTED.`]);
      } else {
         setSecurityStatus('VULNERABLE');
         setLogs(prev => [...prev, `[-] ROLLBACK FAILED: ${data.detail || 'Unknown error'}`]);
      }
    } catch (err) {
      setSecurityStatus('VULNERABLE');
      setLogs(prev => [...prev, `[-] ROLLBACK FAILED: ${err.message}`]);
    }
  };

  const triggerCloudAuth = async (deviceId, oemTarget = 'generic') => {
    setIsAuthorizing(true);
    setLogs(prev => [...prev, `[🔐] Requesting OEM RSA-3072 Signature from Cloud Vault...`]);
    try {
      const res = await fetch('http://localhost:8000/api/security/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, oem_target: oemTarget })
      });
      const data = await res.json();
      if (data.status === 'authorized') {
        setAuthStatus('AUTHORIZED');
        setLogs(prev => [...prev, `[+] SILICON UNLOCKED: BootROM accepting payloads.`]);
      } else {
        throw new Error(data.detail);
      }
    } catch (err) {
      setLogs(prev => [...prev, `[-] AUTHENTICATION FATAL: ${err.message}`]);
    } finally {
      setIsAuthorizing(false);
    }
  };

  const triggerBROMGlitch = async (deviceId) => {
    setIsGlitching(true);
    setLogs(prev => [...prev, `[⚡] Firing USB Fault Injection (TOCTOU) @ Silicon Core...`]);
    try {
      const res = await fetch('http://localhost:8000/api/execution/mtk-glitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId })
      });
      const data = await res.json();
      if (data.status === 'unlocked') {
        setGlitchStatus('UNLOCKED');
        setLogs(prev => [...prev, `[+] BOOTROM STACK OVERFLOW: SLA/DAA bypassed.`]);
        setLogs(prev => [...prev, `[+] SILICON UNLOCKED: Patched DA active in SRAM.`]);
      } else {
        throw new Error(data.detail);
      }
    } catch (err) {
      setLogs(prev => [...prev, `[-] GLITCH FATAL: ${err.message}`]);
    } finally {
      setIsGlitching(false);
    }
  };

  const handleOffensiveModeToggle = () => {
    if (!isOffensiveMode && securityStatus !== 'SECURE') {
        setLogs(prev => [...prev, `[!] WARNING: Complete Shadow Rollback required before unlocking Offensive Mode.`]);
        return;
    }
    setIsOffensiveMode(!isOffensiveMode);
    setLogs(prev => [...prev, isOffensiveMode ? `[!] Offensive Mode deactivated.` : `[🔥] Offensive Mode unlocked. Authorization tokens spoofed.`]);
  };

  return (
    <div className={`flex h-screen bg-slate-950 text-slate-300 font-sans overflow-hidden transition-all ${isGlitching ? 'bg-red-950/20 grayscale-[0.5]' : ''}`}>
      
      {/* LEFT SIDEBAR: The Pulse (Live Detection) */}
      <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-2xl font-black tracking-widest text-orange-500 flex items-center gap-2">
            <Zap size={24} /> PHOENIX
          </h1>
          <span className="text-xs text-slate-500 tracking-widest uppercase">Forge Universal Bridge</span>
        </div>
        
        <div className="p-4 flex-grow overflow-y-auto">
          <div className="text-xs font-bold text-slate-500 mb-4 tracking-wider">ACTIVE HARDWARE (2026+)</div>
          {devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-600 border border-dashed border-slate-700 rounded bg-slate-900/50">
              <Usb size={24} className="mb-2 opacity-50" />
              <span className="text-xs text-center">Awaiting Silicon Signature...<br/>(Connect via EDL/DFU/EUB)</span>
            </div>
          ) : (
            devices.map((dev, idx) => (
              <div key={idx} className="bg-slate-800 p-3 rounded border border-slate-700 mb-4 shadow-lg relative overflow-hidden group">
                <div className={`absolute top-0 left-0 w-1 n-full animate-pulse ${
                    dev.name.includes('MediaTek') ? 'bg-purple-500' : 
                    dev.protocol.includes('Auth') ? 'bg-orange-500' : 'bg-green-500'
                }`}></div>
                <div className="flex justify-between items-start">
                    <h3 className="font-bold text-white text-sm truncate">{dev.name}</h3>
                </div>
                <p className="text-xs text-cyan-400 font-mono mt-1">{dev.protocol}</p>
                
                {/* Rollback Trigger */}
                <button 
                  onClick={() => triggerShadowRollback(dev.serial)}
                  className="mt-3 w-full bg-slate-700 group-hover:bg-blue-900/60 transition-colors text-xs py-1.5 rounded text-white flex items-center justify-center gap-2"
                >
                  <HardDrive size={14} /> Execute Pre-Flight Backup
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* MAIN WORKSPACE */}
      <main className="flex-grow flex flex-col">
        
        {/* TOP BAR: Aegis Security Shield */}
        <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-bold border transition-all ${
              securityStatus === 'SECURE' ? 'bg-green-900/20 text-green-400 border-green-800 shadow-[0_0_10px_rgba(34,197,94,0.15)]' : 
              'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              {securityStatus === 'SECURE' ? <Shield size={14} /> : <ShieldAlert size={14} />}
              SHADOW ROLLBACK: {securityStatus}
            </div>

            <button 
                onClick={handleOffensiveModeToggle}
                className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-bold border transition-all ${
                    isOffensiveMode ? 'bg-red-600 text-white border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
            >
                <Unlock size={14} /> OFFENSIVE MODE: {isOffensiveMode ? 'ACTIVE' : 'LOCKED'}
            </button>
          </div>
          <div className="text-xs text-slate-500 font-mono flex items-center gap-6">
            <div className="flex items-center gap-1.5">
                <Activity size={14} className={isGlitching ? 'animate-spin text-purple-500' : ''} /> 
                EXPLOIT ENGINE: {glitchStatus === 'UNLOCKED' ? <span className="text-purple-400">BYPASSED</span> : <span className="text-slate-500">IDLE</span>}
            </div>
            <div className="flex items-center gap-1.5">
                <Fingerprint size={14} /> TOKEN SPOOLER: {authStatus === 'AUTHORIZED' ? <span className="text-green-500">ACTIVE</span> : <span className="text-slate-500">READY</span>}
            </div>
          </div>
        </header>

        {/* CENTER STAGE: Contextual Tools */}
        <div className="flex-grow p-8 overflow-y-auto">
          <h2 className="text-xl font-bold text-white mb-6">Execution Matrix</h2>
          
          <div className="grid grid-cols-2 gap-6">
            {/* Contextual Actions */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-cyan-900/50 transition-colors">
              <h3 className="text-lg font-bold text-cyan-400 mb-2">Maintenance & Repair</h3>
              <p className="text-xs text-slate-500 mb-6">UFS 5.0 sector mapping and partition surgery.</p>
              
              {/* Dynamic Wall: Qualcomm Auth */}
              {authStatus === 'REQUIRED' && (
                <div className="bg-orange-900/20 border border-orange-800 rounded p-4 mb-4">
                    <h4 className="text-orange-400 font-bold text-sm mb-2 flex items-center gap-2">
                        <ShieldAlert size={14} /> OEM Signature Required
                    </h4>
                    <button 
                        onClick={() => triggerCloudAuth(devices[0]?.serial)}
                        disabled={isAuthorizing}
                        className="w-full bg-orange-600 hover:bg-orange-500 text-white py-2 rounded text-sm font-bold disabled:opacity-50"
                    >
                        {isAuthorizing ? 'SPOOLING TOKEN...' : 'REQUEST CLOUD SIGNATURE'}
                    </button>
                </div>
              )}

              {/* Dynamic Wall: MediaTek Glitch */}
              {glitchStatus === 'REQUIRED' && (
                <div className="bg-purple-900/20 border border-purple-800 rounded p-4 mb-4">
                    <h4 className="text-purple-400 font-bold text-sm mb-2 flex items-center gap-2">
                        <Zap size={14} /> BootROM Fault Injection Required
                    </h4>
                    <button 
                        onClick={() => triggerBROMGlitch(devices[0]?.serial)}
                        disabled={isGlitching}
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2 rounded text-sm font-bold animate-pulse disabled:animate-none disabled:opacity-50"
                    >
                        {isGlitching ? 'FIRING GLITCH...' : 'EXECUTE BOOTROM EXPLOT'}
                    </button>
                </div>
              )}

              {/* Final Actions */}
              <button 
                disabled={securityStatus !== 'SECURE' || authStatus === 'REQUIRED' || glitchStatus === 'REQUIRED'}
                className="w-full mb-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 text-white py-3 rounded text-sm font-bold transition-all shadow-[0_0_15px_rgba(8,145,178,0.2)] disabled:shadow-none"
              >
                Patch VBMeta (Disable AVB 3.0)
              </button>
            </div>

            {/* Offensive Tools */}
            <div className={`bg-slate-900 border rounded-lg p-6 relative overflow-hidden transition-all ${
                isOffensiveMode ? 'border-red-600 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'border-red-900/30'
            }`}>
              <h3 className="text-lg font-bold text-red-400 mb-2 flex items-center gap-2">Offensive Operations</h3>
              <p className="text-xs text-slate-500 mb-6">Master kill-switches and partition overrides.</p>
              
              <button 
                disabled={!isOffensiveMode}
                className="w-full mb-3 bg-red-900/40 hover:bg-red-900/60 disabled:opacity-30 text-red-400 border border-red-900/50 py-3 rounded text-sm font-bold transition-all"
              >
                Inject Poison Pill (Persistence)
              </button>
            </div>
          </div>
        </div>

        {/* BOTTOM: The Chronicle Terminal */}
        <div className="h-48 bg-black border-t border-slate-800 p-4 font-mono text-xs overflow-y-auto flex flex-col">
          <div className="text-slate-600 mb-2 flex items-center gap-2 border-b border-slate-800 pb-2">
            <Terminal size={14} /> SYSTEM CHRONICLE (Silicon Protocol Analyst)
          </div>
          <div className="flex flex-col-reverse">
            {logs.map((log, i) => (
              <div key={i} className={`mb-1 ${
                log.includes('SUCCESS') || log.includes('[+]') ? 'text-green-400' : 
                log.includes('GLITCH') || log.includes('[⚡]') ? 'text-purple-400' :
                log.includes('ERROR') || log.includes('FAILED') || log.includes('[!]') || log.includes('[🔥]') ? 'text-red-500' : 
                'text-slate-400'
              }`}>
                <span className="opacity-50 mr-2">[{new Date().toLocaleTimeString()}]</span>
                {log}
              </div>
            ))}
          </div>
        </div>
      </main>

    </div>
  );
}
