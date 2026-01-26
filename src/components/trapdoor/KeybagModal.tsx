import React from 'react';
import { ShieldAlert, Fingerprint, Lock, Unlock, Copy } from 'lucide-react';
import { copyTextToClipboard } from '@/lib/clipboard';

export interface KeybagDetails {
  type: 'GID' | 'UID' | 'Unknown';
  iv: string;
  key: string;
  isDecrypted: boolean;
}

export function KeybagModal({ keybag, onClose }: { keybag: KeybagDetails; onClose: () => void }) {
  const copyToClipboard = async (text: string) => {
    await copyTextToClipboard(text, {
      successMessage: 'Hex copied to stash',
      errorMessage: 'Copy failed. Please copy manually.',
      unavailableMessage: 'Clipboard not available in this environment.',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-basement-concrete border border-panel rounded-xl shadow-2xl overflow-hidden font-mono">
        {/* Modal Header */}
        <div className="p-4 bg-workbench-steel border-b border-panel flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-spray-magenta" />
            <span className="font-bold text-ink-primary uppercase tracking-tighter">Secure Keybag Breakdown</span>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink-primary" aria-label="Close modal">
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Key Type Identity */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-black/20 border border-panel">
            <div className={`p-3 rounded-lg ${keybag.isDecrypted ? 'bg-state-ready/10' : 'bg-state-danger/10'}`}>
              {keybag.isDecrypted ? (
                <Unlock className="text-state-ready" />
              ) : (
                <Lock className="text-state-danger" />
              )}
            </div>
            <div>
              <p className="text-[10px] text-ink-muted uppercase">Hardware Source</p>
              <h4 className="text-lg font-bold text-ink-primary tracking-widest">{keybag.type} KEY ENVELOPE</h4>
            </div>
          </div>

          {/* Hex Breakdown Section */}
          <div className="space-y-4">
            <div className="group relative">
              <label className="text-[10px] text-ink-muted uppercase mb-1 block">Initialization Vector (IV)</label>
              <div className="flex items-center gap-2 bg-basement-concrete border border-panel p-3 rounded-md text-xs text-spray-cyan break-all">
                {keybag.iv}
                <Copy
                  onClick={() => void copyToClipboard(keybag.iv)}
                  className="w-4 h-4 text-ink-muted cursor-pointer hover:text-spray-cyan"
                />
              </div>
            </div>

            <div className="group relative">
              <label className="text-[10px] text-ink-muted uppercase mb-1 block">
                {keybag.isDecrypted ? 'Decrypted Key Material' : 'Encrypted Keybag Blob'}
              </label>
              <div className="flex items-center gap-2 bg-basement-concrete border border-panel p-3 rounded-md text-xs text-spray-magenta break-all">
                {keybag.key}
                <Copy
                  onClick={() => void copyToClipboard(keybag.key)}
                  className="w-4 h-4 text-ink-muted cursor-pointer hover:text-spray-magenta"
                />
              </div>
            </div>
          </div>

          {/* Forensic Note */}
          <div className="p-3 bg-state-danger/5 border border-state-danger/20 rounded-md">
            <div className="flex items-center gap-2 mb-1">
              <Fingerprint className="w-3.5 h-3.5 text-state-danger" />
              <span className="text-[10px] font-bold text-state-danger uppercase">Security Warning</span>
            </div>
            <p className="text-[9px] text-ink-muted leading-relaxed">
              Treat these values as secrets. Don’t share them in screenshots/logs. Using the wrong key/context against the wrong data
              can cause irreversible failures (including permanent data loss). Keep this material inside your Shadow Archive and only
              use it with authorized workflows you fully understand.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-workbench-steel border-t border-panel text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs bg-basement-concrete border border-panel text-ink-primary hover:bg-workbench-steel transition-colors rounded"
          >
            Close Ledger
          </button>
        </div>
      </div>
    </div>
  );
}

