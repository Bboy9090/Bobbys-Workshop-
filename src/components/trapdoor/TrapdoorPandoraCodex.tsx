/**
 * TrapdoorPandoraCodex
 * 
 * Enhanced Secret Room - Hardware manipulation and Chain-Breaker.
 * Uses Chain-Breaker Dashboard for main interface.
 */

import React from 'react';
import { ChainBreakerDashboard } from './pandora/ChainBreakerDashboard';

interface TrapdoorPandoraCodexProps {
  passcode?: string;
  className?: string;
}

export function TrapdoorPandoraCodex({
  passcode,
  className,
}: TrapdoorPandoraCodexProps) {
  return <ChainBreakerDashboard passcode={passcode} className={className} />;
}
