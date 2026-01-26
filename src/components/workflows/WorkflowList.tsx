/**
 * WorkflowList Component
 * 
 * Displays available workflows with run functionality
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWorkflows, type Workflow } from '@/hooks/use-workflows';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';
import { Play, FileText, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface WorkflowListProps {
  caseId?: string;
  onWorkflowRun?: (jobId: string) => void;
}

/**
 * Render a list of available workflows and provide controls to run a workflow for a selected case.
 *
 * Renders a loading state while workflows load, an empty state when none exist, or a responsive grid of
 * workflow cards. Each card shows name, optional gate count, description, tags, and a "Run Workflow" button
 * which is disabled when no `caseId` is provided. Attempting to run without `caseId` shows an error toast.
 *
 * @param caseId - Optional identifier of the currently selected case; required to enable running a workflow.
 * @param onWorkflowRun - Optional callback invoked with the created job's ID after a workflow run is started.
 * @returns The component's rendered JSX: a loading view, an empty view, or a grid of workflow cards with run controls.
 */
export function WorkflowList({ caseId, onWorkflowRun }: WorkflowListProps) {
  const { workflows, loading, runWorkflow } = useWorkflows();

  const handleRunWorkflow = async (workflowId: string) => {
    if (!caseId) {
      toast.error('Select a case before running a workflow.');
      return;
    }

    const result = await runWorkflow(caseId, workflowId, {
      userId: 'anonymous',
      parameters: {},
    });

    if (result && result.job) {
      if (onWorkflowRun) {
        onWorkflowRun(result.job.id);
      }
    }
  };

  if (loading) {
    return <LoadingState message="Loading workflows..." />;
  }

  if (workflows.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="w-12 h-12" />}
        title="No workflows available"
        description="No workflows are currently available"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-ink-primary">Workflows</h2>
        <p className="text-sm text-ink-muted">Select a workflow to run for your case</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {workflows.map((workflow) => (
          <Card
            key={workflow.id}
            className="bg-workbench-steel border border-panel"
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-ink-primary">{workflow.name}</CardTitle>
                {workflow.required_gates && workflow.required_gates.length > 0 && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    {workflow.required_gates.length} gates
                  </Badge>
                )}
              </div>
              {workflow.description && (
                <CardDescription className="text-ink-muted">{workflow.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {workflow.tags && workflow.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {workflow.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <Button
                  onClick={() => handleRunWorkflow(workflow.id)}
                  disabled={!caseId}
                  className="w-full bg-spray-cyan/20 text-spray-cyan border border-spray-cyan/50 hover:bg-spray-cyan/30"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Run Workflow
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}