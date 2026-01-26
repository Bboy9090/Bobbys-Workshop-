/**
 * Error Boundary for Secret Rooms
 * 
 * Catches React errors and displays user-friendly error messages.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
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

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center h-full bg-basement-concrete">
          <div className="text-center max-w-md p-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-state-danger/20 border border-state-danger/30 mb-4">
              <AlertTriangle className="w-8 h-8 text-state-danger" />
            </div>
            <h2 className="text-xl font-bold text-ink-primary mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-ink-muted mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 rounded-lg bg-spray-cyan/20 border border-spray-cyan/30 text-spray-cyan hover:bg-spray-cyan/30 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg bg-basement-concrete border border-panel text-ink-primary hover:bg-workbench-steel transition-colors"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
