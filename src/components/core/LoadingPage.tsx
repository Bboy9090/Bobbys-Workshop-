/**
 * PHOENIX FORGE - Loading Page
 * 
 * A minimal, elegant loading state with:
 * - Pulsing phoenix ember
 * - Subtle fire glow
 * - System initialization text
 */

import { cn } from '@/lib/utils';
import { Flame } from 'lucide-react';

export function LoadingPage() {
  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 50% 50%, #0F0F1A 0%, #0A0A12 50%, #050508 100%)'
      }}
    >
      {/* Subtle ambient glow */}
      <div className="absolute w-96 h-96 opacity-20"
        style={{
          background: 'radial-gradient(circle, rgba(255, 77, 0, 0.3) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      {/* Central loader */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Pulsing ring */}
        <div className="relative">
          <div className="w-16 h-16 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(255, 77, 0, 0.15) 0%, rgba(255, 215, 0, 0.1) 100%)',
              border: '1px solid rgba(255, 77, 0, 0.2)',
            }}
          >
            <Flame className="w-7 h-7 text-phoenix-fire-core animate-pulse" />
          </div>
          
          {/* Orbiting dot */}
          <div className="absolute inset-0">
            <div className="w-full h-full animate-spin" style={{ animationDuration: '3s' }}>
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-phoenix-fire-core"
                style={{ boxShadow: '0 0 8px rgba(255, 77, 0, 0.6)' }}
              />
            </div>
          </div>
        </div>

        {/* Loading text */}
        <div className="mt-6 flex items-center gap-2">
          <span className="text-xs font-mono text-phoenix-ink-muted tracking-wider">
            INITIALIZING FORGE
          </span>
          <div className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1 h-1 rounded-full bg-phoenix-ink-muted animate-pulse"
                style={{ animationDelay: `${i * 0.3}s` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom system info */}
      <div className="absolute bottom-6 left-6 font-mono text-[10px] text-phoenix-ink-subtle">
        <span>PHOENIX FORGE v5.0.0</span>
      </div>

      <div className="absolute bottom-6 right-6 font-mono text-[10px] text-phoenix-ink-subtle flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-phoenix-success-core animate-pulse" />
        <span>SYSTEMS ONLINE</span>
      </div>
    </div>
  );
}
