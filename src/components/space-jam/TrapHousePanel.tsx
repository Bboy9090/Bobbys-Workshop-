/**
 * 🏠 TrapHousePanel Component
 * 
 * Underground trap house workshop panel
 * Basement vibes with grit
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Lock, Zap, Shield } from 'lucide-react';

interface TrapHousePanelProps {
  className?: string;
  children?: React.ReactNode;
  title?: string;
  locked?: boolean;
  variant?: 'basement' | 'walls' | 'ceiling';
}

export const TrapHousePanel: React.FC<TrapHousePanelProps> = ({
  className,
  children,
  title,
  locked = false,
  variant = 'basement'
}) => {
  const variantClasses = {
    basement: 'bg-trap-basement border-trap-border',
    walls: 'bg-trap-walls border-trap-border',
    ceiling: 'bg-trap-ceiling border-trap-border',
  };

  return (
    <div
      className={cn(
        'relative border-2 rounded-lg p-6',
        variantClasses[variant],
        'trap-house-grid',
        locked && 'opacity-60',
        className
      )}
    >
      {/* Grid Overlay */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(42, 42, 42, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(42, 42, 42, 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
        }}
      />

      {/* Title Bar */}
      {title && (
        <div className="relative z-10 flex items-center justify-between mb-4 pb-3 border-b border-trap-border">
          <h3 className="text-legendary font-display text-lg uppercase tracking-wider flex items-center gap-2">
            {locked && <Lock className="w-4 h-4 text-ink-muted" />}
            {title}
          </h3>
          {!locked && (
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-spray-neon-cyan animate-pulse" />
              <Shield className="w-4 h-4 text-spray-neon-green" />
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className={cn(
        'relative z-10',
        locked && 'blur-sm pointer-events-none'
      )}>
        {children}
      </div>

      {/* Locked Overlay */}
      {locked && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="bg-trap-basement/90 border-2 border-trap-border rounded-lg px-6 py-4">
            <Lock className="w-8 h-8 text-ink-muted mx-auto mb-2" />
            <p className="text-ink-muted text-sm font-mono uppercase tracking-wider">
              Locked
            </p>
          </div>
        </div>
      )}

      {/* Corner Accents */}
      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-spray-neon-cyan opacity-30" />
      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-spray-neon-pink opacity-30" />
      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-spray-neon-yellow opacity-30" />
      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-spray-neon-green opacity-30" />
    </div>
  );
};
