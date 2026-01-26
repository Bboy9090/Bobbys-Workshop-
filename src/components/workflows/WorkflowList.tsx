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

interface WorkflowListProps {
  caseId?: string;
  onWorkflowRun?: (jobId: string) => void;
}

export function WorkflowList({ caseId, onWorkflowRun }: WorkflowListProps) {
  const { workflows, loading, runWorkflow } = useWorkflows();

  const handleRunWorkflow = async (workflowId: string) => {
    if (!caseId) {
      // TODO: Show error or prompt for case selection
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
