/**
 * WorkbenchCases Screen
 * 
 * Case management screen with case list and workflow execution
 */

import { useState } from 'react';
import { CaseList } from '@/components/cases/CaseList';
import { WorkflowList } from '@/components/workflows/WorkflowList';
import { JobStatus } from '@/components/jobs/JobStatus';
import { JobEvents } from '@/components/jobs/JobEvents';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Workflow, Activity } from 'lucide-react';

export function WorkbenchCases() {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const handleCaseSelect = (caseId: string) => {
    setSelectedCaseId(caseId);
  };

  const handleWorkflowRun = (jobId: string) => {
    setSelectedJobId(jobId);
    setActiveTab('jobs'); // Switch to jobs tab to show job status
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-primary font-mono mb-2">
          Cases
        </h1>
        <p className="text-sm text-ink-muted">
          Manage device repair and service cases
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-midnight-room">
          <TabsTrigger value="cases" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Cases
          </TabsTrigger>
          <TabsTrigger value="workflows" className="flex items-center gap-2" disabled={!selectedCaseId}>
            <Workflow className="w-4 h-4" />
            Workflows
          </TabsTrigger>
          <TabsTrigger value="jobs" className="flex items-center gap-2" disabled={!selectedJobId}>
            <Activity className="w-4 h-4" />
            Jobs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cases" className="mt-4">
          <CaseList onCaseSelect={handleCaseSelect} />
        </TabsContent>

        <TabsContent value="workflows" className="mt-4">
          {selectedCaseId ? (
            <WorkflowList caseId={selectedCaseId} onWorkflowRun={handleWorkflowRun} />
          ) : (
            <div className="text-center py-12 text-ink-muted">
              <Workflow className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Select a case to view workflows</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="jobs" className="mt-4 space-y-4">
          {selectedJobId ? (
            <>
              <JobStatus jobId={selectedJobId} />
              <JobEvents jobId={selectedJobId} autoRefresh={true} />
            </>
          ) : (
            <div className="text-center py-12 text-ink-muted">
              <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No job selected</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
