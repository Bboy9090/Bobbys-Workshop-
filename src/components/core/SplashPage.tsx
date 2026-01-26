/**
 * PHOENIX FORGE - Splash Page
 * 
 * "Rise from the Ashes. Every Device Reborn."
 * 
 * A legendary entrance featuring:
 * - Phoenix rising animation
 * - Fire/gold gradient effects
 * - Ember particles
 * - Smooth transitions
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Flame } from 'lucide-react';

interface SplashPageProps {
  onComplete: () => void;
  duration?: number;
}

export function SplashPage({ onComplete, duration = 2200 }: SplashPageProps) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter');

  useEffect(() => {
    // Phase timeline
    const enterTimer = setTimeout(() => setPhase('hold'), 400);
    const exitTimer = setTimeout(() => setPhase('exit'), duration - 400);
    const completeTimer = setTimeout(onComplete, duration);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [duration, onComplete]);

  return (
    <div className={cn(
      "fixed inset-0 flex items-center justify-center overflow-hidden transition-opacity duration-400",
      phase === 'exit' && "opacity-0"
    )} style={{
      background: 'radial-gradient(ellipse at 50% 100%, #1a0a0a 0%, #0a0a12 40%, #050508 100%)'
    }}>
      {/* Ambient glow from below */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-30"
        style={{
          background: 'radial-gradient(ellipse at center bottom, rgba(255, 77, 0, 0.4) 0%, rgba(255, 215, 0, 0.2) 30%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Ember particles */}
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 rounded-full"
          style={{
            left: `${20 + Math.random() * 60}%`,
            bottom: '20%',
            background: `rgba(255, ${150 + Math.random() * 100}, 0, ${0.6 + Math.random() * 0.4})`,
            animation: `ember-rise ${3 + Math.random() * 2}s ease-out infinite`,
            animationDelay: `${Math.random() * 2}s`,
          }}
        />
      ))}

      {/* Main content */}
      <div className={cn(
        "relative z-10 text-center transition-all duration-700",
        phase === 'enter' && "opacity-0 translate-y-8 scale-95",
        phase === 'hold' && "opacity-100 translate-y-0 scale-100",
        phase === 'exit' && "opacity-0 -translate-y-4 scale-105"
      )}>
        {/* Phoenix Icon */}
        <div className="relative mb-8">
          <div className={cn(
            "w-24 h-24 mx-auto rounded-2xl flex items-center justify-center transition-all duration-700",
            phase === 'hold' && "animate-float"
          )}
            style={{
              background: 'linear-gradient(135deg, #FF4D00 0%, #FFD700 50%, #FF6B2C 100%)',
              boxShadow: phase === 'hold' 
                ? '0 0 60px rgba(255, 77, 0, 0.5), 0 0 120px rgba(255, 215, 0, 0.3), 0 20px 40px rgba(0,0,0,0.5)' 
                : 'none',
            }}
          >
            <Flame className="w-12 h-12 text-white drop-shadow-lg" />
          </div>
          
          {/* Outer ring pulse */}
          <div className={cn(
            "absolute inset-0 w-24 h-24 mx-auto rounded-2xl border-2 border-phoenix-fire-core/30",
            phase === 'hold' && "animate-ping"
          )} style={{ animationDuration: '2s' }} />
        </div>

        {/* Title */}
        <h1 className="text-5xl font-bold tracking-tight mb-2"
          style={{
            background: 'linear-gradient(135deg, #FF4D00 0%, #FFD700 50%, #FF6B2C 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: 'none',
            filter: 'drop-shadow(0 0 20px rgba(255, 77, 0, 0.5))',
          }}
        >
          PHOENIX FORGE
        </h1>

        {/* Tagline */}
        <p className="text-sm text-phoenix-ink-secondary font-medium tracking-widest uppercase mt-4">
          Rise from the Ashes
        </p>

        {/* Loading indicator */}
        <div className="mt-8 flex items-center justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-phoenix-fire-core"
              style={{
                animation: 'pulse 1.4s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Bottom gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32"
        style={{
          background: 'linear-gradient(to top, rgba(255, 77, 0, 0.05) 0%, transparent 100%)',
        }}
      />

      {/* Scanlines effect */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,1) 2px, rgba(255,255,255,1) 4px)',
        }}
      />

      <style>{`
        @keyframes ember-rise {
          0% {
            opacity: 0;
            transform: translateY(0) scale(1);
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 0.5;
          }
          100% {
            opacity: 0;
            transform: translateY(-200px) scale(0.5);
          }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}
