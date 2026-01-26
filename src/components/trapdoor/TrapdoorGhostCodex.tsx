/**
 * TrapdoorGhostCodex
 * 
 * Secret Room #9 - Metadata shredding and privacy tools.
 * Features: Metadata shredder, canary tokens, burner personas.
 */

import React, { useState } from 'react';
import { Ghost, FileX, AlertTriangle, User, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/lib/app-context';

interface TrapdoorGhostCodexProps {
  passcode?: string;
  className?: string;
}

type Tab = 'shredder' | 'canary' | 'persona' | 'alerts';

export function TrapdoorGhostCodex({
  passcode,
  className,
}: TrapdoorGhostCodexProps) {
  const { backendAvailable } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('shredder');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [shredding, setShredding] = useState(false);
  const [canaryType, setCanaryType] = useState('pdf');
  const [personas, setPersonas] = useState<any[]>([]);

  const FASTAPI_URL = process.env.VITE_FASTAPI_URL || 'http://127.0.0.1:8000';

  const handleShred = async () => {
    if (!selectedFile || !passcode || !backendAvailable) return;

    setShredding(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('preserve_structure', 'true');

      const response = await fetch(`${FASTAPI_URL}/api/v1/trapdoor/ghost/shred`, {
        method: 'POST',
        headers: {
          'X-Secret-Room-Passcode': passcode,
        },
        body: formData,
      });

      const data = await response.json();
      
      if (data.ok) {
        // Success - show download link
        alert('Metadata shredded! Download link: ' + data.data.download_url);
      } else {
        throw new Error(data.error?.message || 'Shredding failed');
      }
    } catch (error) {
      console.error('Shred error:', error);
      alert('Shredding failed: ' + (error as Error).message);
    } finally {
      setShredding(false);
    }
  };

  const handleGenerateCanary = async () => {
    if (!passcode || !backendAvailable) return;

    try {
      const response = await fetch(`${FASTAPI_URL}/api/v1/trapdoor/ghost/canary/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-Room-Passcode': passcode,
        },
        body: JSON.stringify({
          file_type: canaryType,
        }),
      });

      const data = await response.json();
      
      if (data.ok) {
        alert('Canary token generated! Token ID: ' + data.data.token_id);
      } else {
        throw new Error(data.error?.message || 'Canary generation failed');
      }
    } catch (error) {
      console.error('Canary error:', error);
      alert('Canary generation failed: ' + (error as Error).message);
    }
  };

  const handleCreatePersona = async () => {
    if (!passcode || !backendAvailable) return;

    try {
      const response = await fetch(`${FASTAPI_URL}/api/v1/trapdoor/ghost/persona/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-Room-Passcode': passcode,
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      
      if (data.ok) {
        setPersonas([...personas, data.data]);
      } else {
        throw new Error(data.error?.message || 'Persona creation failed');
      }
    } catch (error) {
      console.error('Persona error:', error);
      alert('Persona creation failed: ' + (error as Error).message);
    }
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="p-6 border-b border-panel">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-spray-magenta/20 border border-spray-magenta/30 flex items-center justify-center">
            <Ghost className="w-5 h-5 text-spray-magenta" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink-primary">Ghost Codex</h1>
            <p className="text-sm text-ink-muted">Metadata shredding & privacy tools</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-panel">
        <button
          onClick={() => setActiveTab('shredder')}
          className={cn(
            "px-6 py-3 text-sm font-medium transition-colors border-b-2",
            activeTab === 'shredder'
              ? "border-spray-cyan text-spray-cyan"
              : "border-transparent text-ink-muted hover:text-ink-primary"
          )}
        >
          <FileX className="w-4 h-4 inline mr-2" />
          Shredder
        </button>
        <button
          onClick={() => setActiveTab('canary')}
          className={cn(
            "px-6 py-3 text-sm font-medium transition-colors border-b-2",
            activeTab === 'canary'
              ? "border-spray-cyan text-spray-cyan"
              : "border-transparent text-ink-muted hover:text-ink-primary"
          )}
        >
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          Canary Tokens
        </button>
        <button
          onClick={() => setActiveTab('persona')}
          className={cn(
            "px-6 py-3 text-sm font-medium transition-colors border-b-2",
            activeTab === 'persona'
              ? "border-spray-cyan text-spray-cyan"
              : "border-transparent text-ink-muted hover:text-ink-primary"
          )}
        >
          <User className="w-4 h-4 inline mr-2" />
          Personas
        </button>
        <button
          onClick={() => setActiveTab('alerts')}
          className={cn(
            "px-6 py-3 text-sm font-medium transition-colors border-b-2",
            activeTab === 'alerts'
              ? "border-spray-cyan text-spray-cyan"
              : "border-transparent text-ink-muted hover:text-ink-primary"
          )}
        >
          <Bell className="w-4 h-4 inline mr-2" />
          Alerts
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'shredder' && (
          <div className="space-y-6">
            <div className="p-6 rounded-lg bg-workbench-steel border border-panel">
              <h3 className="text-lg font-medium text-ink-primary mb-4">Metadata Shredder</h3>
              <div className="space-y-4">
                <label className="block text-sm font-medium text-ink-primary">
                  Select File to Shred
                </label>
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 rounded-lg bg-basement-concrete border border-panel text-ink-primary"
                />
                {selectedFile && (
                  <div className="p-4 rounded bg-basement-concrete border border-panel">
                    <p className="text-sm text-ink-primary">Selected: {selectedFile.name}</p>
                  </div>
                )}
                <button
                  onClick={handleShred}
                  disabled={!selectedFile || shredding}
                  className="px-4 py-2 rounded-lg bg-spray-cyan/20 border border-spray-cyan/30 text-spray-cyan hover:bg-spray-cyan/30 transition-colors disabled:opacity-50"
                >
                  {shredding ? 'Shredding...' : 'Shred Metadata'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'canary' && (
          <div className="space-y-6">
            <div className="p-6 rounded-lg bg-workbench-steel border border-panel">
              <h3 className="text-lg font-medium text-ink-primary mb-4">Canary Token Generator</h3>
              <div className="space-y-4">
                <label className="block text-sm font-medium text-ink-primary">
                  File Type
                </label>
                <select
                  value={canaryType}
                  onChange={(e) => setCanaryType(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-basement-concrete border border-panel text-ink-primary"
                >
                  <option value="pdf">PDF</option>
                  <option value="docx">DOCX</option>
                  <option value="txt">TXT</option>
                </select>
                <button
                  onClick={handleGenerateCanary}
                  className="px-4 py-2 rounded-lg bg-spray-cyan/20 border border-spray-cyan/30 text-spray-cyan hover:bg-spray-cyan/30 transition-colors"
                >
                  Generate Canary Token
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'persona' && (
          <div className="space-y-6">
            <div className="p-6 rounded-lg bg-workbench-steel border border-panel">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-ink-primary">Burner Personas</h3>
                <button
                  onClick={handleCreatePersona}
                  className="px-4 py-2 rounded-lg bg-spray-cyan/20 border border-spray-cyan/30 text-spray-cyan hover:bg-spray-cyan/30 transition-colors"
                >
                  Create Persona
                </button>
              </div>
              <div className="space-y-2">
                {personas.map((persona, idx) => (
                  <div key={idx} className="p-4 rounded bg-basement-concrete border border-panel">
                    <p className="text-sm font-medium text-ink-primary">{persona.name}</p>
                    <p className="text-xs text-ink-muted">{persona.email}</p>
                    <p className="text-xs text-ink-muted">{persona.phone}</p>
                  </div>
                ))}
                {personas.length === 0 && (
                  <p className="text-sm text-ink-muted">No personas created yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <CanaryDashboard passcode={passcode} />
        )}
      </div>
    </div>
  );
}
