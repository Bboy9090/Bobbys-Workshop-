/**
 * Error Boundary for Secret Rooms
 * 
 * Catches React errors and displays user-friendly error messages.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  resetCount: number;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      resetCount: 0,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      resetCount: 0,
      copied: false,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Show toast notification
    toast.error('An error occurred', {
      description: error.message || 'Something went wrong. Please try refreshing.',
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleCopyError = async () => {
    const err = this.state.error;
    if (!err) return;

    const text = err.stack || err.message || String(err);

    try {
      await navigator.clipboard.writeText(text);
      this.setState({ copied: true });
      toast.success('Copied error details');
      window.setTimeout(() => this.setState({ copied: false }), 2000);
    } catch (e) {
      toast.error('Failed to copy error');
    }
  };

  handleReset = () => {
    try {
      this.props.onReset?.();
    } catch {
      // ignore reset handler errors
    }

    this.setState((prev) => ({
      hasError: false,
      error: null,
      resetCount: prev.resetCount + 1,
      copied: false,
    }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center h-full min-h-[400px] bg-basement-concrete p-6">
          <div className="text-center max-w-md w-full p-6 rounded-xl border border-panel bg-basement-concrete/50 shadow-xl">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-state-danger/20 border border-state-danger/30 mb-4">
              <AlertTriangle className="w-8 h-8 text-state-danger" />
            </div>
            <h2 className="text-xl font-bold text-ink-primary mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-ink-muted mb-4 font-mono bg-black/20 p-3 rounded border border-panel overflow-hidden text-ellipsis">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={this.handleReset}
                className="w-full px-4 py-2.5 rounded-lg bg-spray-cyan text-basement-concrete font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              <div className="flex gap-2">
                <button
                  onClick={this.handleCopyError}
                  className="flex-1 px-4 py-2 rounded-lg bg-basement-concrete border border-panel text-ink-primary hover:bg-workbench-steel transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  {this.state.copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {this.state.copied ? 'Copied' : 'Copy Logs'}
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 px-4 py-2 rounded-lg bg-basement-concrete border border-panel text-ink-primary hover:bg-workbench-steel transition-colors text-sm"
                >
                  Refresh Page
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Force a full unmount/remount after reset so we don’t immediately crash
    return (
      <React.Fragment key={this.state.resetCount}>
        {this.props.children}
      </React.Fragment>
    );
  }
}
