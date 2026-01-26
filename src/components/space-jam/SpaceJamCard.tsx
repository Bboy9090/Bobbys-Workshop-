/**
 * Space Jam Card Component
 * 
 * Legendary card styling for the playground workshop
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface SpaceJamCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'jordan' | 'playground' | 'trap';
  glow?: 'purple' | 'orange' | 'cyan' | 'jordan' | 'none';
}

export const SpaceJamCard: React.FC<SpaceJamCardProps> = ({
  children,
  className,
  variant = 'default',
  glow = 'none'
}) => {
  const variantClasses = {
    default: 'card-space-jam',
    jordan: 'card-jordan',
    playground: 'card-playground',
    trap: 'bg-trap-walls border-2 border-trap-border'
  };

  const glowClasses = {
    purple: 'glow-purple',
    orange: 'glow-orange',
    cyan: 'glow-cyan',
    jordan: 'glow-jordan',
    none: ''
  };

  return (
    <div
      className={cn(
        variantClasses[variant],
        glowClasses[glow],
        'rounded-2xl p-6 transition-all duration-300',
        className
      )}
    >
      {children}
    </div>
  );
};
