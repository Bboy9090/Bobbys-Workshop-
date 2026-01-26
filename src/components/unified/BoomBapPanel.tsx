/**
 * BoomBapPanel Component
 * 
 * Settings panel styled with SP-1200/MPC boom bap aesthetic
 * Based on master theme system
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface BoomBapPanelProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function BoomBapPanel({
  title,
  description,
  children,
  className,
}: BoomBapPanelProps) {
  return (
    <div className={cn('boom-bap-panel rounded-lg p-4', className)}>
      <div className="mb-4">
        <h3 className="boom-bap-text text-xl font-bold uppercase tracking-wider mb-1">
          {title}
        </h3>
        {description && (
          <p className="text-muted-foreground text-sm font-mono">
            {description}
          </p>
        )}
      </div>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
}
