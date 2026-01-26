/**
 * Safety Interlock
 * 
 * Requires 3-second hold for destructive operations.
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SafetyInterlockProps {
  onConfirm: () => void;
  label: string;
  warning: string;
}

export function SafetyInterlock({ onConfirm, label, warning }: SafetyInterlockProps) {
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [holdInterval, setHoldInterval] = useState<NodeJS.Timeout | null>(null);

  const HOLD_DURATION = 3000; // 3 seconds

  const handleMouseDown = () => {
    setIsHolding(true);
    setHoldProgress(0);

    const interval = setInterval(() => {
      setHoldProgress((prev) => {
        const next = prev + 50;
        if (next >= HOLD_DURATION) {
          clearInterval(interval);
          onConfirm();
          setIsHolding(false);
          setHoldProgress(0);
          return 0;
        }
        return next;
      });
    }, 50);

    setHoldInterval(interval);
  };

  const handleMouseUp = () => {
    if (holdInterval) {
      clearInterval(holdInterval);
      setHoldInterval(null);
    }
    setIsHolding(false);
    setHoldProgress(0);
  };

  useEffect(() => {
    return () => {
      if (holdInterval) {
        clearInterval(holdInterval);
      }
    };
  }, [holdInterval]);

  const progressPercent = (holdProgress / HOLD_DURATION) * 100;

  return (
    <div className="space-y-2">
      <div className="p-3 rounded-lg border border-[#FFB000]/30 bg-[#FFB000]/10">
        <div className="flex items-start gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-[#FFB000] shrink-0 mt-0.5" />
          <p className="text-xs text-[#FFB000]">{warning}</p>
        </div>
      </div>

      <button
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={cn(
          "w-full p-3 rounded-lg border transition-all relative overflow-hidden",
          isHolding
            ? "border-[#FF0000] bg-[#FF0000]/20 text-[#FF0000]"
            : "border-[#FFB000]/30 bg-[#FFB000]/10 text-[#FFB000] hover:border-[#FF0000]/50"
        )}
      >
        <div className="relative z-10 flex items-center justify-center gap-2">
          {isHolding && (
            <div className="w-4 h-4 border-2 border-[#FF0000] border-t-transparent rounded-full animate-spin" />
          )}
          <span className="font-medium">{label}</span>
          {isHolding && <span className="text-xs">({Math.round(progressPercent)}%)</span>}
        </div>

        {isHolding && (
          <div
            className="absolute inset-0 bg-[#FF0000]/20 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        )}
      </button>
    </div>
  );
}
