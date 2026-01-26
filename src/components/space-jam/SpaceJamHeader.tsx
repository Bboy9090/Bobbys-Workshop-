/**
 * Space Jam Header Component
 * 
 * Legendary NYC Bugs Bunny / Hare Jordan Playground Header
 */

import React from 'react';
import { Basketball, Zap, Crown } from 'lucide-react';

export const SpaceJamHeader: React.FC = () => {
  return (
    <header className="h-20 bg-gradient-space-jam border-b-4 border-jordan glow-purple relative overflow-hidden">
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-playground" style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 10px,
            rgba(255, 255, 255, 0.1) 10px,
            rgba(255, 255, 255, 0.1) 20px
          )`
        }} />
      </div>

      <div className="relative z-10 h-full flex items-center justify-between px-8">
        {/* Left Side - Logo & Title */}
        <div className="flex items-center gap-6">
          {/* Hare Jordan Icon */}
          <div className="w-16 h-16 rounded-2xl border-4 border-jordan bg-hare-jordan-red flex items-center justify-center animate-bounce-jordan shadow-jordan glow-jordan">
            <span className="text-4xl">🐰</span>
          </div>

          {/* Title */}
          <div>
            <h1 className="text-3xl font-black text-space-jam font-display tracking-wider animate-graffiti mb-1">
              HARE JORDAN'S
            </h1>
            <div className="flex items-center gap-2">
              <Basketball className="w-5 h-5 text-basketball-court animate-dribble" />
              <p className="text-lg text-legendary font-display tracking-wide">
                NYC PLAYGROUND WORKSHOP
              </p>
              <Crown className="w-5 h-5 text-basketball-court animate-bounce" />
            </div>
            <p className="text-xs text-graffiti font-mono tracking-widest mt-1 glow-cyan">
              SPACE JAM • TRAP HOUSE • LEGENDARY
            </p>
          </div>
        </div>

        {/* Right Side - Status Indicators */}
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-trap-walls border-2 border-neon-cyan rounded-lg glow-cyan">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-spray-neon-cyan" />
              <span className="text-sm text-graffiti font-mono font-bold">POWERED UP</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Accent Line */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-spray-neon-cyan via-spray-neon-pink to-spray-neon-yellow animate-pulse" />
    </header>
  );
};
