/**
 * TrapdoorSonicCodex
 * 
 * Secret Room #8 - Audio processing and transcription.
 * Main entry point - shows Wizard Flow or Job Library.
 */

import React, { useState } from 'react';
import { Music, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WizardFlow } from './sonic/WizardFlow';
import { JobLibrary } from './sonic/JobLibrary';
import { JobDetails } from './sonic/JobDetails';

interface TrapdoorSonicCodexProps {
  passcode?: string;
  className?: string;
}

type View = 'wizard' | 'library' | 'job';

export function TrapdoorSonicCodex({
  passcode,
  className,
}: TrapdoorSonicCodexProps) {
  const [currentView, setCurrentView] = useState<View>('library');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const handleJobComplete = (jobId: string) => {
    setSelectedJobId(jobId);
    setCurrentView('job');
  };

  const handleSelectJob = (jobId: string) => {
    setSelectedJobId(jobId);
    setCurrentView('job');
  };

  if (currentView === 'job' && selectedJobId) {
    return (
      <JobDetails
        jobId={selectedJobId}
        passcode={passcode}
        onBack={() => setCurrentView('library')}
      />
    );
  }

  if (currentView === 'wizard') {
    return (
      <WizardFlow
        passcode={passcode}
        onComplete={handleJobComplete}
      />
    );
  }

  // Default: Job Library view
  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="p-6 border-b border-panel">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-spray-magenta/20 border border-spray-magenta/30 flex items-center justify-center">
              <Music className="w-5 h-5 text-spray-magenta" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-ink-primary">Sonic Codex</h1>
              <p className="text-sm text-ink-muted">Audio processing & transcription</p>
            </div>
          </div>
          <button
            onClick={() => setCurrentView('wizard')}
            className="px-4 py-2 rounded-lg bg-spray-cyan/20 border border-spray-cyan/30 text-spray-cyan hover:bg-spray-cyan/30 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Job
          </button>
        </div>
      </div>

      {/* Job Library */}
      <div className="flex-1 overflow-hidden">
        <JobLibrary
          passcode={passcode}
          onSelectJob={handleSelectJob}
        />
      </div>
    </div>
  );
}
