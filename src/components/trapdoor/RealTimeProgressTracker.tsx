/**
 * Real-Time Progress Tracker Component
 * 
 * Display operation progress with step-by-step status
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { CheckCircle, XCircle, Loader2, Circle } from 'lucide-react';

interface OperationStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  output?: string;
  error?: string;
}

interface RealTimeProgressTrackerProps {
  operationId: string;
  correlationId?: string;
  onComplete?: (success: boolean) => void;
}

export const RealTimeProgressTracker: React.FC<RealTimeProgressTrackerProps> = ({
  operationId,
  correlationId,
  onComplete
}) => {
  const [steps, setSteps] = useState<OperationStep[]>([]);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // Poll for progress updates
    const interval = setInterval(async () => {
      if (isComplete) {
        clearInterval(interval);
        return;
      }

      try {
        // TODO: Implement progress polling endpoint
        // const response = await fetch(`/api/v1/trapdoor/operations/${operationId}/progress`);
        // const data = await response.json();
        // updateProgress(data);
      } catch (error) {
        console.error('Progress polling error:', error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [operationId, isComplete]);

  const getStepIcon = (status: OperationStep['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-400" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-[#2FD3FF] animate-spin" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const completedSteps = steps.filter(s => s.status === 'success').length;
  const totalSteps = steps.length;
  const progressPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <Card className="bg-[#141922] border-[#2FD3FF]/20">
      <CardHeader>
        <CardTitle className="text-white">Operation Progress</CardTitle>
        <CardDescription className="text-gray-400">
          {operationId} {correlationId && `(${correlationId})`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Progress</span>
            <span className="text-white font-semibold">
              {completedSteps} / {totalSteps} steps
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        {/* Steps List */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {steps.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Waiting for operation to start...</p>
          ) : (
            steps.map((step) => (
              <div
                key={step.id}
                className={`p-3 rounded border ${
                  step.status === 'running'
                    ? 'bg-[#2FD3FF]/10 border-[#2FD3FF]/50'
                    : step.status === 'success'
                    ? 'bg-green-500/10 border-green-500/50'
                    : step.status === 'failed'
                    ? 'bg-red-500/10 border-red-500/50'
                    : 'bg-[#0B0F14] border-[#2FD3FF]/20'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {getStepIcon(step.status)}
                  <span className="text-white font-medium text-sm">{step.name}</span>
                  <Badge
                    className={
                      step.status === 'success'
                        ? 'bg-green-500/20 text-green-400'
                        : step.status === 'failed'
                        ? 'bg-red-500/20 text-red-400'
                        : step.status === 'running'
                        ? 'bg-[#2FD3FF]/20 text-[#2FD3FF]'
                        : 'bg-gray-500/20 text-gray-400'
                    }
                  >
                    {step.status}
                  </Badge>
                </div>
                {step.output && (
                  <pre className="text-xs text-gray-400 mt-2 bg-[#0B0F14] p-2 rounded overflow-x-auto">
                    {step.output}
                  </pre>
                )}
                {step.error && (
                  <p className="text-xs text-red-400 mt-2">{step.error}</p>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
