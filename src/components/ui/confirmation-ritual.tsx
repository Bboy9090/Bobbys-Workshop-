/**
 * Confirmation Ritual Components
 * 
 * Destructive operations require earned access.
 * Type confirmation. Hold to confirm. Preview the command.
 * No accidents. No excuses.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Shield, Terminal, Clock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface TypeConfirmationProps {
  requiredPhrase: string;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  description?: string;
  riskLevel?: 'medium' | 'high' | 'critical' | 'destructive';
  commandPreview?: string;
  disabled?: boolean;
}

const RISK_STYLES = {
  medium: {
    border: 'border-yellow-500/50',
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    button: 'bg-yellow-600 hover:bg-yellow-700',
  },
  high: {
    border: 'border-orange-500/50',
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    button: 'bg-orange-600 hover:bg-orange-700',
  },
  critical: {
    border: 'border-red-500/50',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    button: 'bg-red-600 hover:bg-red-700',
  },
  destructive: {
    border: 'border-red-600/70',
    bg: 'bg-red-600/20',
    text: 'text-red-500',
    button: 'bg-red-700 hover:bg-red-800',
  },
};

/**
 * Type-to-confirm component
 * User must type exact phrase to proceed
 */
export function TypeConfirmation({
  requiredPhrase,
  onConfirm,
  onCancel,
  title = 'Confirmation Required',
  description,
  riskLevel = 'high',
  commandPreview,
  disabled = false,
}: TypeConfirmationProps) {
  const [input, setInput] = useState('');
  const [isValid, setIsValid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const styles = RISK_STYLES[riskLevel];

  useEffect(() => {
    setIsValid(input.toUpperCase() === requiredPhrase.toUpperCase());
  }, [input, requiredPhrase]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid && !disabled) {
      onConfirm();
    }
  };

  return (
    <div className={cn('rounded-lg border-2 p-6', styles.border, styles.bg)}>
      <div className="flex items-start gap-4">
        <div className={cn('p-3 rounded-full', styles.bg)}>
          <AlertTriangle className={cn('w-6 h-6', styles.text)} />
        </div>
        
        <div className="flex-1">
          <h3 className={cn('text-lg font-bold font-mono', styles.text)}>
            {title}
          </h3>
          
          {description && (
            <p className="text-sm text-ink-muted mt-1">
              {description}
            </p>
          )}

          {commandPreview && (
            <div className="mt-4 bg-black/40 rounded p-3 font-mono text-xs">
              <div className="flex items-center gap-2 text-ink-muted mb-2">
                <Terminal className="w-3 h-3" />
                <span>Command Preview</span>
              </div>
              <code className="text-spray-cyan break-all">{commandPreview}</code>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm text-ink-muted mb-2">
                Type <span className={cn('font-mono font-bold', styles.text)}>{requiredPhrase}</span> to confirm
              </label>
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={requiredPhrase}
                className={cn(
                  'font-mono text-center text-lg tracking-widest uppercase',
                  isValid && 'border-green-500 bg-green-500/10'
                )}
                disabled={disabled}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className="flex-1"
                disabled={disabled}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isValid || disabled}
                className={cn('flex-1', styles.button)}
              >
                {isValid ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirm
                  </>
                ) : (
                  'Type to Enable'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

interface HoldToConfirmProps {
  onConfirm: () => void;
  onCancel?: () => void;
  holdDuration?: number;
  label?: string;
  riskLevel?: 'medium' | 'high' | 'critical' | 'destructive';
  disabled?: boolean;
  className?: string;
}

/**
 * Hold-to-confirm button
 * User must hold button for specified duration
 */
export function HoldToConfirm({
  onConfirm,
  onCancel,
  holdDuration = 2000,
  label = 'Hold to Confirm',
  riskLevel = 'high',
  disabled = false,
  className,
}: HoldToConfirmProps) {
  const [isHolding, setIsHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const styles = RISK_STYLES[riskLevel];

  const startHold = useCallback(() => {
    if (disabled || confirmed) return;
    
    setIsHolding(true);
    startTimeRef.current = Date.now();
    
    holdTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const newProgress = Math.min(100, (elapsed / holdDuration) * 100);
      setProgress(newProgress);
      
      if (elapsed >= holdDuration) {
        setConfirmed(true);
        setIsHolding(false);
        clearInterval(holdTimerRef.current!);
        onConfirm();
      }
    }, 16);
  }, [holdDuration, onConfirm, disabled, confirmed]);

  const endHold = useCallback(() => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
    }
    setIsHolding(false);
    if (!confirmed) {
      setProgress(0);
    }
  }, [confirmed]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearInterval(holdTimerRef.current);
      }
    };
  }, []);

  return (
    <div className={cn('relative', className)}>
      <button
        onMouseDown={startHold}
        onMouseUp={endHold}
        onMouseLeave={endHold}
        onTouchStart={startHold}
        onTouchEnd={endHold}
        disabled={disabled || confirmed}
        className={cn(
          'relative w-full py-4 px-6 rounded-lg font-mono text-lg font-bold transition-all overflow-hidden',
          'border-2',
          styles.border,
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          confirmed ? 'bg-green-600 border-green-500' : styles.bg
        )}
      >
        {/* Progress bar */}
        <motion.div
          className={cn('absolute inset-0', styles.button)}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.05 }}
        />
        
        {/* Label */}
        <span className="relative z-10 flex items-center justify-center gap-2">
          {confirmed ? (
            <>
              <CheckCircle className="w-5 h-5" />
              Confirmed
            </>
          ) : isHolding ? (
            <>
              <Clock className="w-5 h-5 animate-pulse" />
              Hold... {Math.round(progress)}%
            </>
          ) : (
            <>
              <Shield className="w-5 h-5" />
              {label}
            </>
          )}
        </span>
      </button>
      
      {onCancel && !confirmed && (
        <button
          onClick={onCancel}
          className="mt-2 w-full text-center text-sm text-ink-muted hover:text-ink-primary transition-colors"
        >
          Cancel
        </button>
      )}
    </div>
  );
}

interface CommandPreviewProps {
  command: string;
  device?: string;
  parameters?: Record<string, string>;
  className?: string;
}

/**
 * Live command preview
 * Shows exactly what will execute
 */
export function CommandPreview({
  command,
  device,
  parameters,
  className,
}: CommandPreviewProps) {
  return (
    <div className={cn('bg-black/50 rounded-lg border border-panel p-4', className)}>
      <div className="flex items-center gap-2 text-ink-muted text-xs mb-3">
        <Terminal className="w-3 h-3" />
        <span>Command Preview</span>
        {device && (
          <span className="ml-auto text-spray-cyan">@ {device}</span>
        )}
      </div>
      
      <div className="font-mono text-sm">
        <span className="text-green-400">$</span>{' '}
        <span className="text-ink-primary">{command}</span>
      </div>
      
      {parameters && Object.keys(parameters).length > 0 && (
        <div className="mt-3 pt-3 border-t border-panel space-y-1">
          {Object.entries(parameters).map(([key, value]) => (
            <div key={key} className="flex justify-between text-xs">
              <span className="text-ink-muted">{key}</span>
              <span className="text-ink-primary font-mono">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ConfirmationDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  description: string;
  requiredPhrase: string;
  riskLevel?: 'medium' | 'high' | 'critical' | 'destructive';
  commandPreview?: string;
  device?: string;
}

/**
 * Full confirmation dialog with backdrop
 */
export function ConfirmationDialog({
  open,
  onConfirm,
  onCancel,
  title,
  description,
  requiredPhrase,
  riskLevel = 'high',
  commandPreview,
  device,
}: ConfirmationDialogProps) {
  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onCancel}
        />
        
        {/* Dialog */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-lg bg-workbench-steel rounded-xl border border-panel shadow-2xl"
        >
          <div className="p-6">
            <TypeConfirmation
              title={title}
              description={description}
              requiredPhrase={requiredPhrase}
              riskLevel={riskLevel}
              commandPreview={commandPreview}
              onConfirm={onConfirm}
              onCancel={onCancel}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
