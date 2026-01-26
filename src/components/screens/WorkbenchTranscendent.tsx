/**
 * 🌌 Transcendent Legendary Enterprise - Desktop App Screen
 * Autonomous AI • Neural Networks • Self-Evolving Architecture
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranscendentApi } from '@/hooks/use-transcendent-api';
import { useApp } from '@/lib/app-context';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bot,
  Brain,
  Dna,
  Zap,
  Loader2,
  RefreshCw,
  Shield,
  TrendingUp,
  Activity,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function WorkbenchTranscendent() {
  const { backendAvailable } = useApp();
  const api = useTranscendentApi();
  const [status, setStatus] = useState<{
    autonomousMode: boolean;
    decisionsCount: number;
    optimizationsCount: number;
    healingActionsCount: number;
  } | null>(null);
  const [models, setModels] = useState<{ models: Awaited<ReturnType<typeof api.neural.getModels>>['models']; count: number } | null>(null);
  const [evolutionStats, setEvolutionStats] = useState<Awaited<ReturnType<typeof api.evolution.getStats>> | null>(null);
  const [bestConfig, setBestConfig] = useState<Awaited<ReturnType<typeof api.evolution.getBest>> | null>(null);
  const [lastDecision, setLastDecision] = useState<Awaited<ReturnType<typeof api.autonomous.makeDecision>> | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!backendAvailable) return;
    try {
      const s = await api.autonomous.getStatus();
      setStatus(s);
    } catch {
      // ignore
    }
  }, [backendAvailable, api.autonomous.getStatus]);

  const refreshModels = useCallback(async () => {
    if (!backendAvailable) return;
    try {
      const m = await api.neural.getModels();
      setModels(m);
    } catch {
      // ignore
    }
  }, [backendAvailable, api.neural.getModels]);

  const refreshEvolution = useCallback(async () => {
    if (!backendAvailable) return;
    try {
      const [stats, best] = await Promise.all([
        api.evolution.getStats(),
        api.evolution.getBest(),
      ]);
      setEvolutionStats(stats);
      setBestConfig(best);
    } catch {
      setEvolutionStats(null);
      setBestConfig(null);
    }
  }, [backendAvailable, api.evolution.getStats, api.evolution.getBest]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    refreshModels();
  }, [refreshModels]);

  useEffect(() => {
    refreshEvolution();
  }, [refreshEvolution]);

  const handleDecision = async () => {
    try {
      const d = await api.autonomous.makeDecision({
        type: 'performance_optimization',
        context: { responseTime: 250, cacheHitRate: 65 },
      });
      setLastDecision(d);
      await refreshStatus();
      toast.success('Autonomous decision made');
    } catch (e) {
      toast.error(api.error || 'Decision failed');
    }
  };

  const handleHeal = async () => {
    try {
      await api.autonomous.selfHeal({ type: 'service_down', service: 'api-server' });
      await refreshStatus();
      toast.success('Self-heal initiated');
    } catch {
      toast.error(api.error || 'Self-heal failed');
    }
  };

  const handleModeToggle = async (checked: boolean) => {
    try {
      await api.autonomous.setMode(checked);
      await refreshStatus();
      toast.success(checked ? 'Autonomous mode enabled' : 'Autonomous mode disabled');
    } catch {
      toast.error(api.error || 'Mode toggle failed');
    }
  };

  const handleTrain = async () => {
    try {
      const features = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
      const targets = [[10], [20], [30]];
      await api.neural.train(features, targets);
      await refreshModels();
      toast.success('Model trained');
    } catch {
      toast.error(api.error || 'Training failed');
    }
  };

  const handleOptimize = async () => {
    try {
      await api.neural.optimize(
        { cacheTTL: 300, poolSize: 20 },
        { cacheHitRate: 70, responseTime: 150 }
      );
      toast.success('Configuration optimized');
    } catch {
      toast.error(api.error || 'Optimization failed');
    }
  };

  const handleEvolveInit = async () => {
    try {
      await api.evolution.initialize(20);
      await refreshEvolution();
      toast.success('Evolution initialized');
    } catch {
      toast.error(api.error || 'Initialize failed');
    }
  };

  const handleEvolve = async () => {
    try {
      await api.evolution.evolve({
        responseTime: 100,
        cacheHitRate: 80,
        cpuUsage: 60,
      });
      await refreshEvolution();
      toast.success('Evolved to next generation');
    } catch {
      toast.error(api.error || 'Evolve failed');
    }
  };

  const handleEvolveReset = async () => {
    try {
      await api.evolution.reset();
      setEvolutionStats(null);
      setBestConfig(null);
      toast.success('Evolution reset');
    } catch {
      toast.error(api.error || 'Reset failed');
    }
  };

  if (!backendAvailable) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
        <AlertCircle className="h-16 w-16 text-amber-500" />
        <h2 className="text-xl font-bold text-legendary">Backend Not Connected</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Start the backend server to use Transcendent Legendary features. Autonomous AI, Neural Networks, and Self-Evolution require the forge.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold uppercase tracking-wider text-legendary flex items-center gap-3">
            <span className="rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 p-2">
              <Zap className="h-6 w-6 text-white" />
            </span>
            Transcendent Legendary Enterprise
          </h1>
          <p className="text-muted-foreground mt-1">
            Autonomous AI • Neural Networks • Self-Evolving Architecture
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono">
            Enterprise
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refreshStatus();
              refreshModels();
              refreshEvolution();
            }}
            disabled={api.loading}
          >
            {api.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {api.error && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
          <span>{api.error}</span>
          <Button variant="ghost" size="sm" onClick={api.clearError}>Dismiss</Button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {/* Autonomous AI */}
        <Card className="border-2 border-violet-500/30 bg-card/80">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bot className="h-5 w-5 text-violet-500" />
                Autonomous AI
              </CardTitle>
              {status && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="autonomous-mode" className="text-xs">Autonomous</Label>
                  <Switch
                    id="autonomous-mode"
                    checked={status.autonomousMode}
                    onCheckedChange={handleModeToggle}
                    disabled={api.loading}
                  />
                </div>
              )}
            </div>
            <CardDescription>Self-optimizing, self-healing decisions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span>{status.decisionsCount} decisions</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span>{status.healingActionsCount} heals</span>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleDecision} disabled={api.loading}>
                {api.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Make Decision
              </Button>
              <Button size="sm" variant="outline" onClick={handleHeal} disabled={api.loading}>
                Self-Heal
              </Button>
            </div>
            {lastDecision && (
              <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
                <p className="font-medium">Last decision</p>
                <p>Action: {lastDecision.action ?? '—'} • Confidence: {(lastDecision.confidence * 100).toFixed(0)}%</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Neural Networks */}
        <Card className="border-2 border-fuchsia-500/30 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5 text-fuchsia-500" />
              Neural Optimizer
            </CardTitle>
            <CardDescription>Train models, optimize configs, Q-learning</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {models && models.count > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span>{models.count} model(s)</span>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleTrain} disabled={api.loading}>
                {api.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Train Model
              </Button>
              <Button size="sm" variant="outline" onClick={handleOptimize} disabled={api.loading}>
                Optimize Config
              </Button>
              <Button size="sm" variant="ghost" onClick={refreshModels}>Refresh</Button>
            </div>
          </CardContent>
        </Card>

        {/* Self-Evolving */}
        <Card className="border-2 border-cyan-500/30 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Dna className="h-5 w-5 text-cyan-500" />
              Self-Evolving
            </CardTitle>
            <CardDescription>Genetic algorithms, fitness, evolution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {evolutionStats && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Gen {evolutionStats.generations}</div>
                <div>Pop {evolutionStats.populationSize}</div>
                <div>Best fitness {evolutionStats.bestFitness?.toFixed(1) ?? '—'}</div>
                <div>Avg {evolutionStats.avgFitness?.toFixed(1) ?? '—'}</div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleEvolveInit} disabled={api.loading}>
                {api.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Initialize
              </Button>
              <Button size="sm" variant="outline" onClick={handleEvolve} disabled={api.loading}>
                Evolve
              </Button>
              <Button size="sm" variant="ghost" onClick={handleEvolveReset} disabled={api.loading}>
                Reset
              </Button>
            </div>
            {bestConfig && (
              <ScrollArea className="h-24 rounded-lg bg-muted/50 p-2">
                <pre className="text-xs font-mono whitespace-pre-wrap">
                  {JSON.stringify(bestConfig.genes, null, 2)}
                </pre>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Full-width status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transcendent Status</CardTitle>
          <CardDescription>Backend health and API connectivity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg',
              backendAvailable ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            )}>
              <div className={cn('h-2 w-2 rounded-full', backendAvailable ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse')} />
              {backendAvailable ? 'Forge connected' : 'Forge disconnected'}
            </div>
            {status && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted">
                <span>Autonomous: {status.autonomousMode ? 'ON' : 'OFF'}</span>
                <Separator orientation="vertical" className="h-4" />
                <span>Decisions: {status.decisionsCount}</span>
                <Separator orientation="vertical" className="h-4" />
                <span>Heals: {status.healingActionsCount}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
