/**
 * PHOENIX FORGE - The Forge (Secret Rooms)
 * 
 * Advanced operations area featuring:
 * - Unlock Chamber
 * - Flash Forge (Deep)
 * - Root Vault
 * - Bypass Laboratory
 * - Jailbreak Sanctum
 * - Codex Modules (Sonic, Ghost, Pandora)
 */

import { useState, useEffect } from 'react';
import { TrapdoorEntryGate } from '../trapdoor/TrapdoorEntryGate';
import { TrapdoorRoomNavigation, type SecretRoomId } from '../trapdoor/TrapdoorRoomNavigation';
import { TrapdoorUnlockChamber } from '../trapdoor/TrapdoorUnlockChamber';
import { TrapdoorFlashForge } from '../trapdoor/TrapdoorFlashForge';
import { TrapdoorJailbreakSanctum } from '../trapdoor/TrapdoorJailbreakSanctum';
import { TrapdoorRootVault } from '../trapdoor/TrapdoorRootVault';
import { TrapdoorBypassLaboratory } from '../trapdoor/TrapdoorBypassLaboratory';
import { TrapdoorWorkflowEngine } from '../trapdoor/TrapdoorWorkflowEngine';
import { TrapdoorShadowArchive } from '../trapdoor/TrapdoorShadowArchive';
import { TrapdoorToolArsenal } from '../trapdoor/TrapdoorToolArsenal';
import { TrapdoorSonicCodex } from '../trapdoor/TrapdoorSonicCodex';
import { TrapdoorGhostCodex } from '../trapdoor/TrapdoorGhostCodex';
import { TrapdoorPandoraCodex } from '../trapdoor/TrapdoorPandoraCodex';
import { RoomTransition } from '../trapdoor/RoomTransition';
import { useApp } from '@/lib/app-context';
import { Flame } from 'lucide-react';

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
  const [showTransition, setShowTransition] = useState(false);
  const [transitioningTo, setTransitioningTo] = useState<SecretRoomId | null>(null);

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
    setActiveRoom('unlock-chamber');
  };

  const handleRoomChange = (roomId: SecretRoomId) => {
    setTransitioningTo(roomId);
    setShowTransition(true);
  };

  const handleTransitionComplete = () => {
    if (transitioningTo) {
      setActiveRoom(transitioningTo);
      setTransitioningTo(null);
    }
    setShowTransition(false);
  };

  const handleCancel = () => {
    setPasscode(null);
    setActiveRoom(null);
  };

  // Show gate if not unlocked
  if (!passcode) {
    return <TrapdoorEntryGate onUnlock={handleUnlock} onCancel={handleCancel} />;
  }

  // Show transition if needed
  if (showTransition && transitioningTo) {
    const roomNames: Record<SecretRoomId, string> = {
      'unlock-chamber': 'Unlock Chamber',
      'flash-forge': 'Flash Forge',
      'jailbreak-sanctum': 'Jailbreak Sanctum',
      'root-vault': 'Root Vault',
      'bypass-laboratory': 'Bypass Laboratory',
      'workflow-engine': 'Workflow Engine',
      'shadow-archive': 'Shadow Archive',
      'sonic-codex': 'Sonic Codex',
      'ghost-codex': 'Ghost Codex',
      'pandora-codex': 'Pandora Codex',
    };
    
    return (
      <RoomTransition
        roomName={roomNames[transitioningTo] || 'Secret Room'}
        onComplete={handleTransitionComplete}
      />
    );
  }

  // Show rooms interface
  return (
    <div className="h-full flex bg-[#0A0A12]">
      <TrapdoorRoomNavigation
        activeRoom={activeRoom || undefined}
        onSelectRoom={handleRoomChange}
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
        {activeRoom === 'tool-arsenal' && (
          <TrapdoorToolArsenal passcode={passcode} />
        )}
        {activeRoom === 'sonic-codex' && (
          <TrapdoorSonicCodex passcode={passcode} />
        )}
        {activeRoom === 'ghost-codex' && (
          <TrapdoorGhostCodex passcode={passcode} />
        )}
        {activeRoom === 'pandora-codex' && (
          <TrapdoorPandoraCodex passcode={passcode} />
        )}
        {!activeRoom && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#FF4D00]/20 to-[#FFD700]/10 border border-[#FF4D00]/20 flex items-center justify-center">
                <Flame className="w-8 h-8 text-[#FF6B2C]" />
              </div>
              <p className="text-sm text-[#64748B]">
                Select a room from the navigation
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
