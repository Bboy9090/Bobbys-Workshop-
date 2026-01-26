/**
 * Space Jam Navigation Component
 * 
 * Legendary playground-style navigation with graffiti vibes
 */

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  locked?: boolean;
}

interface SpaceJamNavProps {
  items: NavItem[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const SpaceJamNav: React.FC<SpaceJamNavProps> = ({
  items,
  activeTab,
  onTabChange
}) => {
  return (
    <nav className="bg-trap-walls border-r-2 border-space-jam h-full p-4 space-y-2">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        const isLocked = item.locked;

        return (
          <button
            key={item.id}
            onClick={() => !isLocked && onTabChange(item.id)}
            disabled={isLocked}
            className={cn(
              "w-full px-4 py-3 rounded-xl font-display font-bold text-sm tracking-wide transition-all duration-300 relative overflow-hidden group",
              isActive
                ? "btn-space-jam text-legendary shadow-playground"
                : isLocked
                ? "bg-trap-basement border-2 border-trap-border text-ink-muted cursor-not-allowed opacity-50"
                : "bg-trap-walls border-2 border-trap-border text-ink-primary hover:border-neon-cyan hover:text-graffiti hover:glow-cyan"
            )}
          >
            {/* Active Indicator */}
            {isActive && (
              <div className="absolute inset-0 bg-gradient-space-jam opacity-20 animate-pulse" />
            )}

            {/* Content */}
            <div className="relative z-10 flex items-center gap-3">
              <Icon className={cn(
                "w-5 h-5 transition-transform duration-300",
                isActive && "animate-bounce scale-110"
              )} />
              <span className="uppercase">{item.label}</span>
              {isLocked && (
                <span className="ml-auto text-xs">🔒</span>
              )}
            </div>

            {/* Hover Glow Effect */}
            {!isActive && !isLocked && (
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-spray-neon-cyan/10 to-transparent" />
            )}
          </button>
        );
      })}
    </nav>
  );
};
