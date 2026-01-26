/**
 * RiskButton Component
 * 
 * Unified button component using Air Jordan colorways for risk levels
 * Based on master theme system
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Button, ButtonProps } from '@/components/ui/button';

export type RiskLevel = 'high' | 'medium' | 'low' | 'special' | 'warning';

interface RiskButtonProps extends Omit<ButtonProps, 'variant'> {
  riskLevel: RiskLevel;
  children: React.ReactNode;
}

const riskLevelClasses: Record<RiskLevel, string> = {
  high: 'jordan-bred',        // Black/Red - High Risk
  medium: 'jordan-chicago',   // White/Red/Black - Medium Risk
  low: 'jordan-concord',      // White/Purple - Low Risk
  special: 'jordan-spacejam', // Black/Blue - Special
  warning: 'jordan-cement',   // Grey/Red - Warning
};

export function RiskButton({
  riskLevel,
  className,
  children,
  ...props
}: RiskButtonProps) {
  return (
    <Button
      className={cn(riskLevelClasses[riskLevel], className)}
      {...props}
    >
      {children}
    </Button>
  );
}
