/**
 * 🏀 BasketballCourt Component
 * 
 * NYC Playground basketball court background
 * Space Jam court vibes
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface BasketballCourtProps {
  className?: string;
  children?: React.ReactNode;
  showLines?: boolean;
  animated?: boolean;
}

export const BasketballCourt: React.FC<BasketballCourtProps> = ({
  className,
  children,
  showLines = true,
  animated = true
}) => {
  return (
    <div
      className={cn(
        'relative w-full h-full bg-basketball-court overflow-hidden',
        className
      )}
    >
      {/* Court Surface */}
      <div className="absolute inset-0 bg-gradient-to-b from-basketball-court via-[#FFE44D] to-basketball-court opacity-90" />

      {/* Court Lines */}
      {showLines && (
        <>
          {/* Center Circle */}
          <svg
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 opacity-40"
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="var(--basketball-lines)"
              strokeWidth="2"
              strokeDasharray="5,5"
              className={animated ? 'animate-court-lines' : ''}
            />
          </svg>

          {/* Free Throw Lines */}
          <div
            className="absolute top-1/4 left-0 right-0 h-0.5 bg-basketball-lines opacity-40"
            style={{
              boxShadow: '0 0 4px rgba(255, 255, 255, 0.5)',
            }}
          />
          <div
            className="absolute bottom-1/4 left-0 right-0 h-0.5 bg-basketball-lines opacity-40"
            style={{
              boxShadow: '0 0 4px rgba(255, 255, 255, 0.5)',
            }}
          />

          {/* Vertical Center Line */}
          <div
            className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-basketball-lines opacity-40 transform -translate-x-1/2"
            style={{
              boxShadow: '0 0 4px rgba(255, 255, 255, 0.5)',
            }}
          />

          {/* Key Area */}
          <div className="absolute top-1/4 left-0 w-1/4 h-1/2 border-2 border-basketball-lines opacity-30" />
          <div className="absolute bottom-1/4 left-0 w-1/4 h-1/2 border-2 border-basketball-lines opacity-30" />
          <div className="absolute top-1/4 right-0 w-1/4 h-1/2 border-2 border-basketball-lines opacity-30" />
          <div className="absolute bottom-1/4 right-0 w-1/4 h-1/2 border-2 border-basketball-lines opacity-30" />
        </>
      )}

      {/* Court Texture */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            repeating-linear-gradient(
              0deg,
              rgba(0, 0, 0, 0.1) 0px,
              transparent 1px,
              transparent 2px,
              rgba(0, 0, 0, 0.1) 3px
            )
          `,
        }}
      />

      {/* Content */}
      {children && (
        <div className="relative z-10 w-full h-full">
          {children}
        </div>
      )}
    </div>
  );
};
