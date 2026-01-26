/**
 * BackupCard Component
 * 
 * Backup/restore card styled as CD jewel case (90s hip-hop aesthetic)
 * Based on master theme system
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Upload, Trash2, MoreVertical } from 'lucide-react';

interface BackupCardProps {
  backup: {
    id: string;
    name: string;
    date: string;
    size?: string;
    type?: 'full' | 'partial' | 'app';
    device?: string;
  };
  onRestore?: () => void;
  onDelete?: () => void;
  onDownload?: () => void;
  className?: string;
}

export function BackupCard({
  backup,
  onRestore,
  onDelete,
  onDownload,
  className,
}: BackupCardProps) {
  const getTypeColor = () => {
    switch (backup.type) {
      case 'full':
        return 'text-green-400';
      case 'partial':
        return 'text-yellow-400';
      case 'app':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <Card className={cn('cd-jewel-case overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="cd-disc-shine w-12 h-12 rounded-full" />
            <div className="flex-1">
              <CardTitle className="text-base font-display uppercase">
                {backup.name}
              </CardTitle>
              <CardDescription className="text-xs mt-1 font-mono">
                {backup.date} {backup.size && `• ${backup.size}`}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {backup.type && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Type:</span>
              <Badge className={cn('text-xs', getTypeColor())}>
                {backup.type.toUpperCase()}
              </Badge>
            </div>
          )}
          {backup.device && (
            <div className="text-xs text-muted-foreground font-mono">
              Device: {backup.device}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            {onRestore && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={onRestore}
              >
                <Upload className="h-3 w-3 mr-1" />
                Restore
              </Button>
            )}
            {onDownload && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={onDownload}
              >
                <Download className="h-3 w-3 mr-1" />
                Download
              </Button>
            )}
            {onDelete && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
