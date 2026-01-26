/**
 * PHOENIX FORGE - Quick Actions Panel
 * 
 * Quick action buttons for common operations.
 * Styled with Phoenix Forge fire/cosmic theme.
 */

import React from 'react';
import { Smartphone, Zap, Search, RefreshCw, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';

interface QuickAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'phoenix' | 'cosmic' | 'warning';
}

interface WorkbenchQuickActionsProps {
  actions?: QuickAction[];
  onScanDevices?: () => void;
  onFlashDevice?: () => void;
  onSearchFirmware?: () => void;
  onRefresh?: () => void;
}

export function WorkbenchQuickActions({
  actions = [],
  onScanDevices,
  onFlashDevice,
  onSearchFirmware,
  onRefresh,
}: WorkbenchQuickActionsProps) {
  const quickActions: QuickAction[] = actions.length > 0 ? actions : [
    {
      id: 'scan',
      label: 'Scan Devices',
      description: 'Detect connected',
      icon: <Smartphone className="w-5 h-5" />,
      onClick: () => onScanDevices?.(),
      variant: 'cosmic',
    },
    {
      id: 'flash',
      label: 'Flash Device',
      description: 'Start flashing',
      icon: <Zap className="w-5 h-5" />,
      onClick: () => onFlashDevice?.(),
      variant: 'phoenix',
    },
    {
      id: 'search',
      label: 'Find Firmware',
      description: 'Search catalog',
      icon: <Search className="w-5 h-5" />,
      onClick: () => onSearchFirmware?.(),
      variant: 'default',
    },
    {
      id: 'refresh',
      label: 'Refresh',
      description: 'Reload data',
      icon: <RefreshCw className="w-5 h-5" />,
      onClick: () => onRefresh?.(),
      variant: 'default',
    },
  ];

  const getVariantStyles = (variant: string) => {
    switch (variant) {
      case 'phoenix':
        return {
          bg: 'bg-gradient-to-br from-[#FF4D00]/10 to-[#FFD700]/5',
          border: 'border-[#FF4D00]/20 hover:border-[#FF4D00]/40',
          icon: 'text-[#FF6B2C]',
          hover: 'hover:shadow-[0_0_20px_rgba(255,77,0,0.15)]',
        };
      case 'cosmic':
        return {
          bg: 'bg-gradient-to-br from-[#7C3AED]/10 to-[#06B6D4]/5',
          border: 'border-[#7C3AED]/20 hover:border-[#7C3AED]/40',
          icon: 'text-[#A78BFA]',
          hover: 'hover:shadow-[0_0_20px_rgba(124,58,237,0.15)]',
        };
      case 'warning':
        return {
          bg: 'bg-gradient-to-br from-[#F59E0B]/10 to-[#F59E0B]/5',
          border: 'border-[#F59E0B]/20 hover:border-[#F59E0B]/40',
          icon: 'text-[#FCD34D]',
          hover: 'hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]',
        };
      default:
        return {
          bg: 'bg-white/[0.02]',
          border: 'border-white/[0.08] hover:border-white/20',
          icon: 'text-[#94A3B8]',
          hover: '',
        };
    }
  };

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Flame className="w-4 h-4 text-[#FF6B2C]" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => {
            const styles = getVariantStyles(action.variant || 'default');
            
            return (
              <button
                key={action.id}
                onClick={action.onClick}
                disabled={action.disabled}
                className={cn(
                  "flex flex-col items-start gap-1 p-4 rounded-xl border transition-all duration-200",
                  styles.bg,
                  styles.border,
                  styles.hover,
                  "hover:-translate-y-0.5",
                  "active:translate-y-0",
                  action.disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className={cn("mb-1", styles.icon)}>
                  {action.icon}
                </div>
                <span className="text-sm font-semibold text-[#F1F5F9]">
                  {action.label}
                </span>
                {action.description && (
                  <span className="text-xs text-[#64748B]">
                    {action.description}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
