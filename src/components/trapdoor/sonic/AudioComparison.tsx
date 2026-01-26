/**
 * Audio Comparison Component
 * 
 * Toggle between original and enhanced audio with side-by-side waveforms.
 */

import React, { useState } from 'react';
import { ToggleLeft, ToggleRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Waveform } from './Waveform';

interface AudioComparisonProps {
  originalUrl: string;
  enhancedUrl: string;
  className?: string;
}

export function AudioComparison({ originalUrl, enhancedUrl, className }: AudioComparisonProps) {
  const [showEnhanced, setShowEnhanced] = useState(true);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Toggle */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-workbench-steel border border-panel">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-ink-primary">View Mode</span>
          <button
            onClick={() => setShowEnhanced(!showEnhanced)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-spray-cyan/20 border border-spray-cyan/30 text-spray-cyan hover:bg-spray-cyan/30 transition-colors"
          >
            {showEnhanced ? (
              <>
                <ToggleRight className="w-5 h-5" />
                <span>Enhanced</span>
              </>
            ) : (
              <>
                <ToggleLeft className="w-5 h-5" />
                <span>Original</span>
              </>
            )}
          </button>
        </div>
        <div className="text-xs text-ink-muted">
          Click to switch between original and enhanced audio
        </div>
      </div>

      {/* Waveform */}
      <div className="p-4 rounded-lg bg-basement-concrete border border-panel">
        <Waveform
          audioUrl={showEnhanced ? enhancedUrl : originalUrl}
        />
      </div>

      {/* Side-by-side comparison hint */}
      <div className="p-3 rounded-lg bg-workbench-steel/50 border border-panel">
        <p className="text-xs text-ink-muted text-center">
          💡 Tip: Toggle between Original and Enhanced to compare audio quality
        </p>
      </div>
    </div>
  );
}
