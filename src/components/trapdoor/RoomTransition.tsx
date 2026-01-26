/**
 * PHOENIX FORGE - Room Transition Animation
 * 
 * Smooth, stylized transition when entering forge rooms.
 */

import { useEffect, useState } from 'react';
import { Flame, CheckCircle2, Loader2 } from 'lucide-react';

interface RoomTransitionProps {
  roomName: string;
  onComplete: () => void;
}

export function RoomTransition({ roomName, onComplete }: RoomTransitionProps) {
  const [phase, setPhase] = useState<'handshake' | 'loading' | 'complete'>('handshake');

  useEffect(() => {
    const handshakeTimer = setTimeout(() => setPhase('loading'), 800);
    const loadingTimer = setTimeout(() => setPhase('complete'), 1600);
    const completeTimer = setTimeout(() => onComplete(), 2200);

    return () => {
      clearTimeout(handshakeTimer);
      clearTimeout(loadingTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50"
      style={{
        background: 'radial-gradient(ellipse at 50% 50%, #0F0F1A 0%, #0A0A12 50%, #050508 100%)'
      }}
    >
      {/* Ambient fire glow */}
      <div className="absolute w-80 h-80 opacity-20 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(255, 77, 0, 0.4) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      <div className="text-center space-y-6 relative z-10">
        {phase === 'handshake' && (
          <div className="animate-in fade-in duration-300">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 77, 0, 0.2) 0%, rgba(255, 215, 0, 0.1) 100%)',
                border: '2px solid rgba(255, 77, 0, 0.4)',
                boxShadow: '0 0 30px rgba(255, 77, 0, 0.3)',
              }}
            >
              <Flame className="w-10 h-10 text-[#FF6B2C] animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#F1F5F9] mb-2">Secure Handshake</h2>
              <p className="text-sm text-[#64748B]">Establishing connection...</p>
            </div>
          </div>
        )}

        {phase === 'loading' && (
          <div className="animate-in fade-in duration-300">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4"
              style={{
                background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.2) 0%, rgba(6, 182, 212, 0.1) 100%)',
                border: '2px solid rgba(124, 58, 237, 0.4)',
                boxShadow: '0 0 30px rgba(124, 58, 237, 0.3)',
              }}
            >
              <Loader2 className="w-10 h-10 text-[#A78BFA] animate-spin" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#F1F5F9] mb-2">Loading {roomName}</h2>
              <p className="text-sm text-[#64748B]">Initializing systems...</p>
            </div>
          </div>
        )}

        {phase === 'complete' && (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4"
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.1) 100%)',
                border: '2px solid rgba(16, 185, 129, 0.4)',
                boxShadow: '0 0 30px rgba(16, 185, 129, 0.3)',
              }}
            >
              <CheckCircle2 className="w-10 h-10 text-[#10B981]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#F1F5F9] mb-2">Access Granted</h2>
              <p className="text-sm text-[#64748B]">Entering {roomName}...</p>
            </div>
          </div>
        )}

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <div className={`w-2 h-2 rounded-full transition-all ${
            phase === 'handshake' ? 'bg-[#FF6B2C] scale-125' : 'bg-[#FF6B2C]/50'
          }`} />
          <div className={`w-2 h-2 rounded-full transition-all ${
            phase === 'loading' ? 'bg-[#A78BFA] scale-125' : phase === 'complete' ? 'bg-[#A78BFA]/50' : 'bg-white/10'
          }`} />
          <div className={`w-2 h-2 rounded-full transition-all ${
            phase === 'complete' ? 'bg-[#10B981] scale-125' : 'bg-white/10'
          }`} />
        </div>
      </div>
    </div>
  );
}
