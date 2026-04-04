import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, Terminal, Usb, Zap, HardDrive, Cpu, Unlock, Fingerprint, Activity, Smartphone, Gamepad2, Watch, Cloud, Apple, Radio } from 'lucide-react';

export default function PhoenixDashboard() {
  const [devices, setDevices] = useState([]);
  const [securityStatus, setSecurityStatus] = useState('UNVERIFIED'); // UNVERIFIED, SECURE, VULNERABLE
  const [authStatus, setAuthStatus] = useState('NOT_REQUIRED'); // NOT_REQUIRED, REQUIRED, AUTHORIZED
  const [glitchStatus, setGlitchStatus] = useState('NOT_REQUIRED'); // NOT_REQUIRED, REQUIRED, UNLOCKED
  const [appleMode, setAppleMode] = useState('NONE'); // NONE, LEGACY, MODERN
  const [isWirelessRadarActive, setIsWirelessRadarActive] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [logs, setLogs] = useState(['[SYSTEM] Phoenix Forge UI Initialized. Awaiting agnostic hardware...']);
  const [isPolling, setIsPolling] = useState(true);
  const [isOffensiveMode, setIsOffensiveMode] = useState(false);

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
          const appleDev = detectedDevices.find(d => d.name && d.name.includes('iPhone'));
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

  const triggerWearableExploit = async (deviceId, vector, ip = null) => {
    setIsExecuting(true);
    setLogs(prev => [...prev, `[⚡] Firing Wearable Vector: ${vector.toUpperCase()}...`]);
    try {
      const res = await fetch('http://localhost:8000/api/execution/wearable-exploit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, vector: vector, target_ip: ip })
      });
      const data = await res.json();
      if (data.status === 'unlocked') {
        setLogs(prev => [...prev, `[+] WEARABLE UNLOCKED: Execution successful.`]);
      } else {
        throw new Error(data.detail);
      }
    } catch (err) {
      setLogs(prev => [...prev, `[-] WEARABLE EXPLOIT FATAL: ${err.message}`]);
    } finally {
      setIsExecuting(false);
    }
  };

  const toggleWirelessRadar = () => {
    if (!isOffensiveMode) {
        setLogs(prev => [...prev, `[!] WARNING: Wireless Radar requires Offensive Mode to bypass FCC/local restrictions.`]);
        return;
    }
    setIsWirelessRadarActive(!isWirelessRadarActive);
    setLogs(prev => [...prev, isWirelessRadarActive ? `[!] Wireless Radar deactivated.` : `[📡] Scanning local subnet for WearOS broadcast beacons...`]);
  };

  const getDeviceIcon = (dev) => {
    if (dev.category === 'Wearable') return <Watch size={16} />;
    if (dev.category === 'Mobile' && appleMode !== 'NONE') return <Apple size={16} />;
    switch (dev.category) {
        case 'Mobile': return <Smartphone size={16} />;
        case 'Gaming': return <Gamepad2 size={16} />;
        case 'IoT/Embedded': return <Cloud size={16} />;
        default: return <Usb size={16} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-300 font-sans overflow-hidden">
      
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
                onClick={toggleWirelessRadar}
                className={`p-1.5 rounded transition-all ${isWirelessRadarActive ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}
                title="Wireless Radar Scan"
            >
                <Radio size={14} className={isWirelessRadarActive ? 'animate-pulse' : ''} />
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
                    dev.category === 'Wearable' ? 'bg-blue-400' : 'bg-cyan-500'
                }`}></div>
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                        <span className="text-cyan-500">{getDeviceIcon(dev)}</span>
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
            <div className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-bold border ${
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
                <Radio size={14} className={isWirelessRadarActive ? 'text-blue-400' : ''} /> 
                RADAR: {isWirelessRadarActive ? <span className="text-blue-400">SCANNING...</span> : 'OFFLINE'}
            </div>
            <div>
                 RSA-3072 VAULT: <span className="text-green-500">SYNCED</span> | TECH ID: <span className="text-white">BOBBY_01</span>
            </div>
          </div>
        </header>

        {/* CENTER STAGE */}
        <div className="flex-grow p-8 overflow-y-auto">
          <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest">
            {devices[0]?.category === 'Wearable' ? 'Wearables Diagnostic Toolkit' : 'Execution Matrix'}
          </h2>
          
          <div className="grid grid-cols-2 gap-6">
            
            {/* Wearable-Specific Contextual Actions */}
            {devices.some(d => d.category === 'Wearable') && (
                <div className="bg-slate-900 border border-blue-900/40 rounded-lg p-6 hover:border-blue-500 transition-colors relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full"></div>
                    <h3 className="text-lg font-bold text-blue-400 mb-2 flex items-center gap-2">
                        <Watch size={20} /> Wearable Hijack Module
                    </h3>
                    <p className="text-xs text-slate-500 mb-6">Attacking iBus/AWRT diagnostic ports and Wireless ADB beacons.</p>
                    
                    <button 
                        onClick={() => triggerWearableExploit(devices[0].name, 'ibus')}
                        disabled={isExecuting || !devices.find(d => d.protocol.includes('iBus'))}
                        className="w-full mb-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white py-3 rounded text-sm font-bold transition-all shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                    >
                        Execute iBus DFU Restore
                    </button>
                    <button 
                        onClick={() => triggerWearableExploit(null, 'wireless_adb', '192.168.1.145')}
                        disabled={isExecuting || !isWirelessRadarActive}
                        className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white py-3 rounded text-sm font-bold transition-all"
                    >
                        Wireless ADB Hijack (WearOS)
                    </button>
                </div>
            )}

            {/* Standard Repair Tools */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-cyan-900/50 transition-colors">
              <h3 className="text-lg font-bold text-cyan-400 mb-2">Repair & Maintenance</h3>
              <p className="text-xs text-slate-500 mb-6">Autonomous sector recovery and firmware stabilization.</p>
              
              <button 
                disabled={securityStatus !== 'SECURE'}
                className="w-full mb-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 text-white py-3 rounded text-sm font-bold transition-all shadow-[0_0_15px_rgba(8,145,178,0.2)]"
              >
                Reset Wearable FRP (Wireless)
              </button>
              <button 
                disabled={securityStatus !== 'SECURE'}
                className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white py-3 rounded text-sm font-bold transition-all"
              >
                Dump watchOS Flash (AWRT)
              </button>
            </div>

          </div>
        </div>

        {/* BOTTOM: System Chronicle */}
        <div className="h-48 bg-black border-t border-slate-800 p-4 font-mono text-xs overflow-y-auto flex flex-col">
          <div className="text-slate-600 mb-2 flex items-center gap-2 border-b border-slate-800 pb-2 uppercase tracking-widest text-[10px]">
            <Terminal size={14} /> System Chronicle (Silicon Audit Ledger)
          </div>
          <div className="flex flex-col-reverse">
            {logs.map((log, i) => (
              <div key={i} className={`mb-1 ${
                log.includes('SUCCESS') || log.includes('[+]') ? 'text-green-400' : 
                log.includes('[⌚]') || log.includes('[📡]') ? 'text-blue-400' :
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
