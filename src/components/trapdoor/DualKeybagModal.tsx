import React from 'react';
import { ShieldAlert, Fingerprint, Lock, Unlock, Copy, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface KeyContext {
  iv: string;
  key: string;
}

interface DualKeybagModalProps {
  primary: KeyContext;
  secondary?: KeyContext;
  isDual: boolean;
  onClose: () => void;
}

export function DualKeybagModal({ primary, secondary, isDual, onClose }: DualKeybagModalProps) {
  const copyToStash = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch (err) {
      console.error('[DualKeybagModal] Failed to copy:', err);
      toast.error('Copy failed', { description: 'Clipboard permission denied or unavailable.' });
    }
  };

  const KeyBlock = ({
    context,
    title,
    accent,
  }: {
    context: KeyContext;
    title: string;
    accent: 'primary' | 'secondary';
  }) => (
    <div className="flex-1 min-w-[300px] space-y-4 p-4 rounded-lg bg-black/20 border border-panel border-l-4 border-l-spray-cyan">
      <div className="flex items-center justify-between border-b border-panel pb-2 mb-2">
        <h4 className="text-[10px] font-black text-spray-cyan uppercase tracking-widest">{title}</h4>
        <Zap className={`w-3 h-3 ${accent === 'secondary' ? 'text-spray-magenta' : 'text-spray-cyan'}`} />
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[9px] text-ink-muted uppercase block mb-1">Initialization Vector</label>
          <div className="flex items-center justify-between gap-2 bg-basement-concrete p-2 rounded border border-panel text-[11px] text-ink-primary font-mono group">
            <span className="truncate">{context.iv}</span>
            <Copy
              onClick={() => void copyToStash(context.iv, 'IV')}
              className="w-3.5 h-3.5 text-ink-muted cursor-pointer group-hover:text-spray-cyan transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="text-[9px] text-ink-muted uppercase block mb-1">AES Key</label>
          <div className="flex items-center justify-between gap-2 bg-basement-concrete p-2 rounded border border-panel text-[11px] text-spray-magenta font-mono group">
            <span className="truncate">{context.key}</span>
            <Copy
              onClick={() => void copyToStash(context.key, 'Key')}
              className="w-3.5 h-3.5 text-ink-muted cursor-pointer group-hover:text-spray-magenta transition-colors"
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-6">
      <div className="w-full max-w-5xl bg-basement-concrete border border-panel rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden font-mono border-t-4 border-t-spray-cyan">
        {/* Header */}
        <div className="p-4 bg-workbench-steel border-b border-panel flex justify-between items-center">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-state-danger" />
            <h2 className="font-bold text-ink-primary uppercase tracking-tighter">
              Crypto Ledger {isDual ? '[DUAL_CONTEXT]' : '[SINGLE_CONTEXT]'}
            </h2>
            <span className="text-[10px] text-ink-muted uppercase tracking-widest">
              {isDual ? 'Two contexts present' : 'One context present'}
            </span>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink-primary text-xl" aria-label="Close modal">
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex flex-wrap gap-6 mb-6">
            <KeyBlock context={primary} title="Primary Context" accent="primary" />
            {isDual && secondary && <KeyBlock context={secondary} title="Secondary Context" accent="secondary" />}
          </div>

          {/* Warning Section */}
          <div className="bg-state-danger/10 border border-state-danger/30 p-4 rounded-lg flex gap-4 items-start">
            <Fingerprint className="w-6 h-6 text-state-danger shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {isDual ? (
                  <Unlock className="w-3.5 h-3.5 text-state-danger" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-state-danger" />
                )}
                <h5 className="text-[10px] font-bold text-state-danger uppercase">Sensitive material</h5>
              </div>
              <p className="text-[9px] text-ink-muted leading-relaxed">
                Treat these values as secrets. Don’t share them in screenshots/logs. Using the wrong key/context against the wrong
                data can cause irreversible failures (including permanent data loss). If you’re not sure what a context represents,
                keep it in the Shadow Archive and only use it with well-understood, authorized workflows.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-workbench-steel border-t border-panel text-right flex justify-between items-center">
          <span className="text-[8px] text-ink-muted uppercase">Shadow Archive // Secure Session</span>
          <button
            onClick={onClose}
            className="px-6 py-2 text-xs bg-spray-cyan text-basement-concrete font-bold hover:opacity-90 transition-all rounded glow-cyan"
          >
            Close Ledger
          </button>
        </div>
      </div>
    </div>
  );
}

