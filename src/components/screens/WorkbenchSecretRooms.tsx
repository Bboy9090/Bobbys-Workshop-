/**
 * WorkbenchSecretRooms
 * 
 * Trapdoor entry gate + room navigation + room workbenches
 */

import React, { useState, useEffect } from 'react';
import { TrapdoorEntryGate } from '../trapdoor/TrapdoorEntryGate';
import { TrapdoorRoomNavigation, type SecretRoomId } from '../trapdoor/TrapdoorRoomNavigation';
import { TrapdoorUnlockChamber } from '../trapdoor/TrapdoorUnlockChamber';
import { TrapdoorFlashForge } from '../trapdoor/TrapdoorFlashForge';
import { TrapdoorJailbreakSanctum } from '../trapdoor/TrapdoorJailbreakSanctum';
import { TrapdoorRootVault } from '../trapdoor/TrapdoorRootVault';
import { TrapdoorBypassLaboratory } from '../trapdoor/TrapdoorBypassLaboratory';
import { TrapdoorWorkflowEngine } from '../trapdoor/TrapdoorWorkflowEngine';
import { TrapdoorShadowArchive } from '../trapdoor/TrapdoorShadowArchive';
import { useApp } from '@/lib/app-context';

interface TrapdoorDevice {
  serial: string;
  model?: string;
  platform: 'android' | 'ios' | 'unknown';
  state: string;
}

export function WorkbenchSecretRooms() {
  const { backendAvailable } = useApp();
  const [passcode, setPasscode] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<SecretRoomId | null>(null);
  const [devices, setDevices] = useState<TrapdoorDevice[]>([]);

  // Fetch devices when unlocked
  useEffect(() => {
    if (!passcode || !backendAvailable) {
      setDevices([]);
      return;
    }

    let cancelled = false;

    async function fetchDevices() {
      try {
        const response = await fetch('/api/v1/adb/devices');
        const data = await response.json();
        
        if (cancelled) return;

        if (data.ok && data.data?.devices) {
          setDevices(data.data.devices.map((d: { serial: string; model?: string; state: string }) => ({
            serial: d.serial,
            model: d.model || 'Unknown',
            platform: 'android' as const,
            state: d.state,
          })));
        }
      } catch {
        if (cancelled) return;
        setDevices([]);
      }
    }

    fetchDevices();
    const interval = setInterval(fetchDevices, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [passcode, backendAvailable]);

  const handleUnlock = (enteredPasscode: string) => {
    setPasscode(enteredPasscode);
    // Default to Unlock Chamber
    setActiveRoom('unlock-chamber');
  };

  const handleCancel = () => {
    setPasscode(null);
    setActiveRoom(null);
  };

  // Show gate if not unlocked
  if (!passcode) {
    return <TrapdoorEntryGate onUnlock={handleUnlock} onCancel={handleCancel} />;
  }

  // Show rooms interface
  return (
    <div className="h-full flex bg-basement-concrete">
      <TrapdoorRoomNavigation
        activeRoom={activeRoom || undefined}
        onSelectRoom={setActiveRoom}
      />
      
      <div className="flex-1 overflow-hidden">
        {activeRoom === 'unlock-chamber' && (
          <TrapdoorUnlockChamber
            passcode={passcode}
            devices={devices}
          />
        )}
        {activeRoom === 'flash-forge' && (
          <TrapdoorFlashForge
            passcode={passcode}
            devices={devices}
          />
        )}
        {activeRoom === 'jailbreak-sanctum' && (
          <TrapdoorJailbreakSanctum passcode={passcode} />
        )}
        {activeRoom === 'root-vault' && (
          <TrapdoorRootVault
            passcode={passcode}
            devices={devices}
          />
        )}
        {activeRoom === 'bypass-laboratory' && (
          <TrapdoorBypassLaboratory
            passcode={passcode}
            devices={devices}
          />
        )}
        {activeRoom === 'workflow-engine' && (
          <TrapdoorWorkflowEngine passcode={passcode} />
        )}
        {activeRoom === 'shadow-archive' && (
          <TrapdoorShadowArchive passcode={passcode} />
        )}
        {!activeRoom && (
          <div className="h-full flex items-center justify-center text-ink-muted">
            <p className="text-sm font-mono">
              Select a room from the navigation
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
