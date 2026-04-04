import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, Terminal, Usb, Zap, HardDrive, Cpu, Unlock, Fingerprint, Activity, Smartphone, Gamepad2, Watch, Cloud, Apple, Radio, Ghost, LifeBuoy } from 'lucide-react';

export default function PhoenixDashboard() {
  const [devices, setDevices] = useState([]);
  const [securityStatus, setSecurityStatus] = useState('UNVERIFIED'); // UNVERIFIED, SECURE, VULNERABLE
  const [authStatus, setAuthStatus] = useState('NOT_REQUIRED'); // NOT_REQUIRED, REQUIRED, AUTHORIZED
  const [glitchStatus, setGlitchStatus] = useState('NOT_REQUIRED'); // NOT_REQUIRED, REQUIRED, UNLOCKED
  const [appleMode, setAppleMode] = useState('NONE'); // NONE, LEGACY, MODERN
  const [isWirelessRadarActive, setIsWirelessRadarActive] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [logs, setLogs] = useState(['[SYSTEM] Phoenix Forge UI Initialized. Master Architecture active.']);
  const [isPolling, setIsPolling] = useState(true);
  const [isOffensiveMode, setIsOffensiveMode] = useState(false);
  const [showRecoveryPlan, setShowRecoveryPlan] = useState(false);

  // 1. The Hardware Pulse (Polling the Agnostic Backend)
  useEffect(() => {
    if (!isPolling) return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:8000/api/devices/scan');
        if (res.ok) {
          const data = await res.json();
          const detectedDevices = data.devices || [];
          setDevices(detectedDevices);

          // Context Detection: Apple
          const appleDev = detectedDevices.find(d => d.name && (d.name.includes('iPhone') || d.name.includes('Apple Watch')));
          if (appleDev) {
            setAppleMode(appleDev.protocol.includes('DFU') ? 'LEGACY' : 'MODERN');
          } else {
            setAppleMode('NONE');
          }

          // Detect Qualcomm Auth status
          const needsAuth = detectedDevices.some(d => d.protocol && d.protocol.includes('Auth'));
          if (needsAuth && authStatus === 'NOT_REQUIRED') {
            setAuthStatus('REQUIRED');
            setLogs(prev => [...prev.slice(-50), `[!] HANDSHAKE ALERT: Silicon RSA-3072 signature required.`]);
          } else if (!needsAuth && authStatus !== 'AUTHORIZED') {
            setAuthStatus('NOT_REQUIRED');
          }

          // Detect MediaTek Glitch status
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

  const triggerShadowRollback = async (deviceId) => {
    setLogs(prev => [...prev, `[🛡️] Initiating Shadow Rollback for ${deviceId}...`]);
    try {
      const res = await fetch('http://localhost:8000/api/security/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId })
      });
      const data = await res.json();
      if (data.status === 'secure') {
        setSecurityStatus('SECURE');
        setLogs(prev => [...prev, `[+] SUCCESS: Partitions secured. Write access GRANTED.`]);
      }
    } catch (err) {
        setSecurityStatus('VULNERABLE');
        setLogs(prev => [...prev, `[-] ROLLBACK FAILED: ${err.message}`]);
    }
  };

  const triggerGamingExploit = async (deviceId, target, payload) => {
    setIsExecuting(true);
    setLogs(prev => [...prev, `[⚡] Firing Gaming Sector Vector: ${target.toUpperCase()}...`]);
    try {
      const res = await fetch('http://localhost:8000/api/execution/gaming-exploit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, target: target, payload: payload })
      });
      const data = await res.json();
      if (data.status === 'unlocked') {
        setLogs(prev => [...prev, `[+] GAMING SECTOR UNLOCKED: ${target.toUpperCase()} success.`]);
      } else {
        throw new Error(data.detail);
      }
    } catch (err) {
      setLogs(prev => [...prev, `[-] GAMING EXPLOIT FATAL: ${err.message}`]);
    } finally {
      setIsExecuting(false);
    }
  };

  const getDeviceIcon = (dev) => {
    if (dev.category === 'Gaming') return <Gamepad2 size={16} />;
    if (dev.category === 'Wearable') return <Watch size={16} />;
    if (dev.category === 'Mobile' && appleMode !== 'NONE') return <Apple size={16} />;
    switch (dev.category) {
        case 'Mobile': return <Smartphone size={16} />;
        case 'IoT/Embedded': return <Cloud size={16} />;
        default: return <Usb size={16} />;
    }
  };

  return (
    <div className={`flex h-screen bg-slate-950 text-slate-300 font-sans overflow-hidden transition-all ${
        devices.some(d => d.name.includes('Switch')) ? 'border-t-4 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : ''
    }`}>
      
      {/* LEFT SIDEBAR: The Pulse */}
      <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-2xl font-black tracking-widest text-orange-500 flex items-center gap-2">
            <Zap size={24} /> PHOENIX
          </h1>
          <span className="text-xs text-slate-500 tracking-widest uppercase">Universal Bridge v5.0.0</span>
        </div>
        
        <div className="p-4 flex-grow overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <div className="text-xs font-bold text-slate-500 tracking-wider uppercase">Active Targets</div>
            <button 
                onClick={() => setShowRecoveryPlan(!showRecoveryPlan)}
                className={`p-1.5 rounded transition-all ${showRecoveryPlan ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-500'}`}
                title="Disaster Recovery Protocol"
            >
                <LifeBuoy size={14} />
            </button>
          </div>

          {devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-600 border border-dashed border-slate-700 rounded bg-slate-900/50">
              <Usb size={24} className="mb-2 opacity-50" />
              <span className="text-xs text-center italic">Scanning USB / UART / Wi-Fi...</span>
            </div>
          ) : (
            devices.map((dev, idx) => (
              <div key={idx} className="bg-slate-800 p-3 rounded border border-slate-700 mb-4 shadow-lg relative overflow-hidden group">
                <div className={`absolute top-0 left-0 w-1 h-full animate-pulse ${
                    dev.category === 'Gaming' ? 'bg-red-500' : 'bg-cyan-500'
                }`}></div>
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                        <span className={dev.category === 'Gaming' ? 'text-red-400' : 'text-cyan-500'}>{getDeviceIcon(dev)}</span>
                        <h3 className="font-bold text-white text-sm truncate">{dev.name}</h3>
                    </div>
                </div>
                <p className="text-xs text-cyan-400 font-mono mt-1 opacity-70">{dev.protocol}</p>
                
                <button 
                  onClick={() => triggerShadowRollback(dev.name)}
                  className="mt-3 w-full bg-slate-700 hover:bg-slate-600 transition-colors text-xs py-1.5 rounded text-white flex items-center justify-center gap-2"
                >
                  <HardDrive size={14} /> Execute Master Backup
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
              securityStatus === 'SECURE' ? 'bg-green-900/20 text-green-400 border-green-800 shadow-[0_0_10px_rgba(34,197,94,0.1)]' : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              {securityStatus === 'SECURE' ? <Shield size={14} /> : <ShieldAlert size={14} />}
              SAFETY: {securityStatus}
            </div>

            <button 
                onClick={() => setIsOffensiveMode(!isOffensiveMode)}
                className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-bold border transition-all ${
                    isOffensiveMode ? 'bg-red-600 text-white border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
            >
                <Unlock size={14} /> OFFENSIVE MODE: {isOffensiveMode ? 'ACTIVE' : 'LOCKED'}
            </button>
          </div>
          <div className="text-xs text-slate-500 font-mono flex items-center gap-6">
            <div className="flex items-center gap-1.5">
                <Activity size={14} className={isExecuting ? 'animate-spin' : ''} /> 
                EXPLOIT ENGINE: {isExecuting ? <span className="text-orange-400">EXECUTING...</span> : <span className="text-green-500">READY</span>}
            </div>
            <div>
                 RSA-3072 VAULT: <span className="text-green-500">SYNCED</span> | TECH ID: <span className="text-white font-bold">BOBBY_01</span>
            </div>
          </div>
        </header>

        {/* CENTER STAGE */}
        <div className="flex-grow p-8 overflow-y-auto">
          {showRecoveryPlan ? (
             <div className="bg-red-950/20 border border-red-800 rounded-lg p-8 animate-in fade-in slide-in-from-top-4">
                <h2 className="text-2xl font-black text-red-500 mb-6 flex items-center gap-3">
                    < लाइफबुय size={28} /> DISASTER RECOVERY PROTOCOL
                </h2>
                <div className="grid grid-cols-2 gap-8 text-sm">
                    <div className="bg-black/40 p-4 rounded border border-red-900/30">
                        <h4 className="text-red-400 font-bold mb-2">SCENARIO: HARD BRICK</h4>
                        <p className="text-slate-400 font-mono leading-relaxed">
                            1. Short hardware Test Points on PCB.<br/>
                            2. Connect USB to Master Port.<br/>
                            3. Select 'Restore from Shadow Rollback'.
                        </p>
                    </div>
                    <div className="bg-black/40 p-4 rounded border border-red-900/30">
                        <h4 className="text-red-400 font-bold mb-2">SCENARIO: AUTH ERROR</h4>
                        <p className="text-slate-400 font-mono leading-relaxed">
                            1. Verify technician cloud session.<br/>
                            2. Check Internet/RSA server status.<br/>
                            3. Reboot Phoenix Forge instance.
                        </p>
                    </div>
                </div>
                <button 
                    onClick={() => setShowRecoveryPlan(false)}
                    className="mt-8 bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-6 rounded transition-all"
                >
                    Return to Execution Matrix
                </button>
             </div>
          ) : (
            <>
                <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest flex items-center gap-3">
                    <Cpu size={24} className="text-orange-500" /> 
                    {devices[0]?.category === 'Gaming' ? 'Gaming Sector Recovery Toolkit' : 'Master Execution Matrix'}
                </h2>
                
                <div className="grid grid-cols-2 gap-6">
                    {/* Gaming Sector Tools */}
                    {devices.some(d => d.category === 'Gaming') && (
                        <div className="bg-slate-900 border border-red-900/40 rounded-lg p-6 hover:border-red-500 transition-colors relative group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                                <Gamepad2 size={64} className="text-red-500" />
                            </div>
                            <h3 className="text-lg font-bold text-red-500 mb-2 flex items-center gap-2">
                                <Ghost size={20} /> Stack-Smash Payload Injector
                            </h3>
                            <p className="text-xs text-slate-500 mb-6 font-mono">Bypassing Tegra X1 security and x86 UEFI/BIOS corruption.</p>
                            
                            {devices.find(d => d.name.includes('Switch')) ? (
                                <button 
                                    onClick={() => triggerGamingExploit(devices[0].name, 'switch', 'hekate.bin')}
                                    disabled={isExecuting || !isOffensiveMode}
                                    className="w-full mb-3 bg-red-600 hover:bg-red-500 disabled:opacity-30 text-white py-3 rounded text-sm font-black transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                                >
                                    INJECT HEKATE (TEGRA RCM)
                                </button>
                            ) : (
                                <button 
                                    onClick={() => triggerGamingExploit(devices[0].name, 'steam_deck', 'deck_f7a.rom')}
                                    disabled={isExecuting || !isOffensiveMode}
                                    className="w-full mb-3 bg-red-600 hover:bg-red-500 disabled:opacity-30 text-white py-3 rounded text-sm font-black transition-all"
                                >
                                    RECOVER STEAM DECK BIOS (SPI)
                                </button>
                            )}
                            <div className="text-[10px] text-slate-500 italic mt-2 border-t border-slate-800 pt-2">
                                * Offensive Mode required for hardware-level stack smashing.
                            </div>
                        </div>
                    )}

                    {/* Universal Maintenance */}
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-cyan-900/50 transition-colors">
                        <h3 className="text-lg font-bold text-cyan-400 mb-2">Repair & Maintenance</h3>
                        <p className="text-xs text-slate-500 mb-6">Agnostic sector recovery and system stabilization.</p>
                        
                        <button 
                            disabled={securityStatus !== 'SECURE'}
                            className="w-full mb-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 text-white py-3 rounded text-sm font-bold transition-all"
                        >
                            Execute Master Partition Sync
                        </button>
                        <button 
                            disabled={securityStatus !== 'SECURE'}
                            className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white py-3 rounded text-sm font-bold transition-all"
                        >
                            Verify Silicon Checksums
                        </button>
                    </div>
                </div>
            </>
          )}
        </div>

        {/* BOTTOM: System Chronicle */}
        <div className="h-48 bg-black border-t border-slate-800 p-4 font-mono text-xs overflow-y-auto flex flex-col shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
          <div className="text-slate-600 mb-2 flex items-center justify-between border-b border-slate-800 pb-2 uppercase tracking-widest text-[10px]">
            <div className="flex items-center gap-2"><Terminal size={14} /> System Chronicle (Silicon Audit Ledger)</div>
            <div className="text-slate-800">PhoenixForge v5.0.0-PRO</div>
          </div>
          <div className="flex flex-col-reverse">
            {logs.map((log, i) => (
              <div key={i} className={`mb-1 ${
                log.includes('SUCCESS') || log.includes('[+]') ? 'text-green-400' : 
                log.includes('[🎮]') || log.includes('[⚡]') ? 'text-red-400' :
                log.includes('ERROR') || log.includes('FAILED') ? 'text-red-500' : 
                'text-slate-400'
              }`}>
                <span className="opacity-40 mr-2 font-light">[{new Date().toLocaleTimeString()}]</span>
                {log}
              </div>
            ))}
          </div>
        </div>
      </main>

    </div>
  );
}
