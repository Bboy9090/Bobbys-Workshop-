/**
 * PHOENIX FORGE - The Forge Entry Gate
 * 
 * Secure entry point to advanced operations.
 * Requires passcode, system checks, and explicit acceptance.
 */

import { useState, useEffect } from 'react';
import { Flame, CheckCircle2, XCircle, AlertTriangle, Shield, ChevronDown } from 'lucide-react';
import { ToolboxDangerLever } from '../toolbox/ToolboxDangerLever';
import { cn } from '@/lib/utils';
import { checkBackendHealth } from '@/lib/backend-health';
import { Badge } from '../ui/badge';

interface SystemCheck {
  id: string;
  label: string;
  status: 'checking' | 'ready' | 'failed';
}

interface TrapdoorEntryGateProps {
  onUnlock: (passcode: string) => void;
  onCancel: () => void;
}

export function TrapdoorEntryGate({ onUnlock, onCancel }: TrapdoorEntryGateProps) {
  const [passcode, setPasscode] = useState('');
  const [acceptanceText, setAcceptanceText] = useState('');
  const [systemChecks, setSystemChecks] = useState<SystemCheck[]>([
    { id: 'backend', label: 'Backend Connected', status: 'checking' },
    { id: 'catalog', label: 'Catalog Loaded', status: 'checking' },
    { id: 'locks', label: 'Lock Manager Active', status: 'checking' },
    { id: 'audit', label: 'Audit Logger Active', status: 'checking' },
  ]);
  const [allChecksPassed, setAllChecksPassed] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const requiredAcceptance = 'I ACCEPT THE RISKS';

  useEffect(() => {
    checkBackendHealth().then((health) => {
      setSystemChecks(prev => prev.map(check => 
        check.id === 'backend' 
          ? { ...check, status: health.isHealthy ? 'ready' : 'failed' }
          : check
      ));
    });

    setTimeout(() => {
      setSystemChecks(prev => prev.map(check => 
        check.id !== 'backend' 
          ? { ...check, status: 'ready' }
          : check
      ));
    }, 500);
  }, []);

  useEffect(() => {
    const allReady = systemChecks.every(check => check.status === 'ready');
    setAllChecksPassed(allReady);
  }, [systemChecks]);

  const handleConfirm = () => {
    if (passcode && acceptanceText === requiredAcceptance && allChecksPassed) {
      onUnlock(passcode);
    }
  };

  const canProceed = passcode.length > 0 && 
                     acceptanceText === requiredAcceptance && 
                     allChecksPassed;

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'radial-gradient(ellipse at 50% 100%, #1a0a0a 0%, #0a0a12 40%, #050508 100%)'
      }}
    >
      {/* Ambient glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] opacity-20 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center bottom, rgba(255, 77, 0, 0.4) 0%, rgba(255, 215, 0, 0.2) 30%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4"
            style={{
              background: 'linear-gradient(135deg, rgba(255, 77, 0, 0.15) 0%, rgba(255, 215, 0, 0.1) 100%)',
              border: '2px solid rgba(255, 77, 0, 0.3)',
              boxShadow: '0 0 40px rgba(255, 77, 0, 0.2)',
            }}
          >
            <Flame className="w-10 h-10 text-[#FF6B2C]" />
          </div>
          <h1 className="text-3xl font-bold"
            style={{
              background: 'linear-gradient(135deg, #FF4D00 0%, #FFD700 50%, #FF6B2C 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            The Forge
          </h1>
          <p className="text-sm text-[#64748B]">Advanced device operations</p>
        </div>

        {/* System Checks */}
        <div className="p-4 rounded-xl bg-[#14142B] border border-white/[0.08]">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-3 flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" />
            System Status
          </h3>
          <div className="space-y-2">
            {systemChecks.map((check) => (
              <div key={check.id} className="flex items-center justify-between py-1">
                <span className="text-sm text-[#94A3B8]">{check.label}</span>
                <div className="flex items-center gap-2">
                  {check.status === 'checking' && (
                    <div className="w-4 h-4 border-2 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
                  )}
                  {check.status === 'ready' && (
                    <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                  )}
                  {check.status === 'failed' && (
                    <XCircle className="w-4 h-4 text-[#F43F5E]" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rules Drawer */}
        <div className="space-y-2">
          <button
            onClick={() => setShowRules(!showRules)}
            className="flex items-center justify-between w-full p-3 rounded-xl bg-[#14142B] border border-white/[0.08] hover:border-[#FF4D00]/30 transition-all"
          >
            <span className="text-sm font-medium text-[#F1F5F9] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
              Rules & Warnings
            </span>
            <ChevronDown className={cn(
              "w-4 h-4 text-[#64748B] transition-transform",
              showRules && "rotate-180"
            )} />
          </button>
          
          {showRules && (
            <div className="p-4 rounded-xl bg-[#14142B] border border-[#F59E0B]/30 space-y-3 text-sm">
              <p className="font-semibold text-[#FCD34D] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Important Notice
              </p>
              <ul className="space-y-2 text-[#94A3B8]">
                <li className="flex items-start gap-2">
                  <span className="text-[#FF6B2C] mt-1">•</span>
                  All operations are for owner devices only
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FF6B2C] mt-1">•</span>
                  Destructive operations cannot be undone
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FF6B2C] mt-1">•</span>
                  Every action is audit-logged
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FF6B2C] mt-1">•</span>
                  Device locks prevent concurrent operations
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FF6B2C] mt-1">•</span>
                  Use responsibly and in compliance with laws
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Passcode Input */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
            Forge Passcode
          </label>
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Enter passcode"
            className="w-full px-4 py-3 rounded-xl bg-[#0A0A12] border border-white/[0.08] text-[#F1F5F9] font-mono placeholder:text-[#475569] focus:outline-none focus:border-[#FF4D00]/50 focus:shadow-[0_0_20px_rgba(255,77,0,0.1)] transition-all"
          />
        </div>

        {/* Acceptance Text */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
            Type: "{requiredAcceptance}"
          </label>
          <input
            type="text"
            value={acceptanceText}
            onChange={(e) => setAcceptanceText(e.target.value)}
            placeholder={requiredAcceptance}
            className={cn(
              "w-full px-4 py-3 rounded-xl bg-[#0A0A12] border transition-all",
              "text-[#F1F5F9] font-mono placeholder:text-[#475569]",
              "focus:outline-none",
              acceptanceText === requiredAcceptance 
                ? "border-[#10B981] focus:shadow-[0_0_20px_rgba(16,185,129,0.1)]" 
                : acceptanceText.length > 0 
                  ? "border-[#F43F5E]" 
                  : "border-white/[0.08] focus:border-[#FF4D00]/50"
            )}
          />
          {acceptanceText.length > 0 && acceptanceText !== requiredAcceptance && (
            <p className="text-xs text-[#F43F5E]">Text must match exactly</p>
          )}
          {acceptanceText === requiredAcceptance && (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
              <p className="text-xs text-[#10B981]">Acceptance confirmed</p>
            </div>
          )}
        </div>

        {/* Danger Lever */}
        <ToolboxDangerLever
          onConfirm={handleConfirm}
          disabled={!canProceed}
          label="HOLD TO ENTER THE FORGE"
          warning="This grants access to advanced operations. Proceed only if you understand the risks."
        />

        {/* Cancel */}
        <button
          onClick={onCancel}
          className="w-full py-2 text-sm text-[#64748B] hover:text-[#94A3B8] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
