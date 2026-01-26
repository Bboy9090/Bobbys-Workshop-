/**
 * Console Log Stream
 * 
 * Terminal-style output window with color-coded messages.
 */

import React, { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Log {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'error' | 'warn';
  message: string;
}

interface ConsoleLogProps {
  logs: Log[];
}

export function ConsoleLog({ logs }: ConsoleLogProps) {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'success':
        return 'text-[#00FF41]';
      case 'error':
        return 'text-[#FF0000]';
      case 'warn':
        return 'text-[#FFB000]';
      default:
        return 'text-[#00FF41]';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <div className="flex flex-col h-full bg-[#050505]">
      <div className="p-4 border-b border-[#FFB000]/30 flex items-center gap-2">
        <Terminal className="w-5 h-5 text-[#00FF41]" />
        <h2 className="text-lg font-bold text-[#00FF41]">Console</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 font-mono text-sm">
        {logs.length === 0 ? (
          <div className="text-[#FFB000]/50">Waiting for operations...</div>
        ) : (
          <div className="space-y-1">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2">
                <span className="text-[#FFB000]/50 shrink-0">
                  [{formatTimestamp(log.timestamp)}]
                </span>
                <span className={cn("shrink-0", getLevelColor(log.level))}>
                  [{log.level.toUpperCase()}]
                </span>
                <span className={cn("flex-1", getLevelColor(log.level))}>
                  {log.message}
                </span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
