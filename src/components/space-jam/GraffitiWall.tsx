/**
 * 🎨 GraffitiWall Component
 * 
 * NYC Playground graffiti wall with spray paint effects
 * Bronx grit street art vibes
 */

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface GraffitiTag {
  text: string;
  color: string;
  x: number;
  y: number;
  rotation: number;
  size: number;
}

interface GraffitiWallProps {
  className?: string;
  tags?: string[];
  animated?: boolean;
}

const defaultTags = [
  'HARE JORDAN',
  'SPACE JAM',
  'LEGENDARY',
  'NYC',
  'BRONX',
  'TRAP HOUSE',
  'WORKSHOP',
  '1996'
];

const sprayColors = [
  'var(--spray-neon-cyan)',
  'var(--spray-neon-pink)',
  'var(--spray-neon-yellow)',
  'var(--spray-neon-green)',
  'var(--spray-neon-orange)',
  'var(--spray-neon-purple)',
  'var(--space-jam-purple)',
  'var(--space-jam-orange)',
];

export const GraffitiWall: React.FC<GraffitiWallProps> = ({
  className,
  tags = defaultTags,
  animated = true
}) => {
  const [graffitiTags, setGraffitiTags] = useState<GraffitiTag[]>([]);

  useEffect(() => {
    const generateTags = () => {
      const newTags: GraffitiTag[] = tags.map((tag, index) => ({
        text: tag,
        color: sprayColors[index % sprayColors.length],
        x: Math.random() * 80 + 10, // 10-90%
        y: Math.random() * 80 + 10, // 10-90%
        rotation: (Math.random() - 0.5) * 30, // -15 to +15 degrees
        size: Math.random() * 0.5 + 0.8, // 0.8-1.3 scale
      }));
      setGraffitiTags(newTags);
    };

    generateTags();
    if (animated) {
      const interval = setInterval(() => {
        generateTags();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [tags, animated]);

  return (
    <div
      className={cn(
        'relative w-full h-full bg-nyc-concrete overflow-hidden',
        'before:absolute before:inset-0',
        'before:bg-[radial-gradient(circle_at_30%_40%,rgba(0,255,255,0.1)_0%,transparent_50%)]',
        'before:bg-[radial-gradient(circle_at_70%_60%,rgba(255,0,255,0.1)_0%,transparent_50%)]',
        className
      )}
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
    >
      {/* Graffiti Tags */}
      {graffitiTags.map((tag, index) => (
        <div
          key={`${tag.text}-${index}`}
          className={cn(
            'absolute font-display font-black uppercase tracking-wider',
            animated && 'animate-graffiti-fade'
          )}
          style={{
            left: `${tag.x}%`,
            top: `${tag.y}%`,
            transform: `rotate(${tag.rotation}deg) scale(${tag.size})`,
            color: tag.color,
            textShadow: `
              0 0 10px ${tag.color},
              0 0 20px ${tag.color},
              0 0 30px ${tag.color},
              2px 2px 4px rgba(0, 0, 0, 0.8)
            `,
            fontSize: `${Math.max(16, 24 * tag.size)}px`,
            filter: 'drop-shadow(0 0 8px rgba(0,0,0,0.5))',
            zIndex: index,
          }}
        >
          {tag.text}
        </div>
      ))}

      {/* Spray Paint Drips */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-8 opacity-30"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: `linear-gradient(to bottom, ${sprayColors[i % sprayColors.length]}, transparent)`,
              transform: `rotate(${(Math.random() - 0.5) * 20}deg)`,
            }}
          />
        ))}
      </div>

      {/* Concrete Texture Overlay */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `
            repeating-linear-gradient(
              45deg,
              transparent,
              transparent 2px,
              rgba(255, 255, 255, 0.05) 2px,
              rgba(255, 255, 255, 0.05) 4px
            )
          `,
        }}
      />
    </div>
  );
};
