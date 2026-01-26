/**
 * CaseList Component
 * 
 * Displays a list of cases with create case functionality
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCases, type Case } from '@/hooks/use-cases';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';
import { CreateCaseDialog } from './CreateCaseDialog';
import { CaseDetailsDialog } from './CaseDetailsDialog';
import { Plus, FileText, Calendar } from 'lucide-react';

interface CaseListProps {
  onCaseSelect?: (caseId: string) => void;
}

/**
 * Render a list of cases with controls to create new cases and view case details.
 *
 * Fetches the available cases on mount, manages local state for selection and dialogs,
 * and updates the displayed list when a new case is created.
 *
 * @param onCaseSelect - Optional callback invoked with the selected case's `id` when a case is opened
 * @returns The rendered CaseList component tree
 */
export function CaseList({ onCaseSelect }: CaseListProps) {
  const { listCases, loading } = useCases();
  const [cases, setCases] = useState<Case[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  const handleCaseClick = async (caseId: string) => {
    setSelectedCaseId(caseId);
    setShowDetailsDialog(true);
    if (onCaseSelect) {
      onCaseSelect(caseId);
    }
  };

  const handleCaseCreated = (newCase: Case) => {
    setCases([newCase, ...cases]);
    setShowCreateDialog(false);
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      const result = await listCases();
      if (isMounted) {
        setCases(result);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [listCases]);

  if (loading && cases.length === 0) {
    return <LoadingState message="Loading cases..." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink-primary">Cases</h2>
          <p className="text-sm text-ink-muted">Manage device repair and service cases</p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-spray-cyan/20 text-spray-cyan border border-spray-cyan/50 hover:bg-spray-cyan/30"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Case
        </Button>
      </div>

      {cases.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-12 h-12" />}
          title="No cases yet"
          description="Create your first case to get started"
          action={{
            label: "Create Case",
            onClick: () => setShowCreateDialog(true)
          }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cases.map((caseItem) => (
            <Card
              key={caseItem.id}
              className="cursor-pointer hover:border-spray-cyan/50 transition-colors bg-workbench-steel border border-panel"
              onClick={() => handleCaseClick(caseItem.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-ink-primary">{caseItem.title}</CardTitle>
                  <Badge
                    variant={
                      caseItem.status === 'open'
                        ? 'default'
                        : caseItem.status === 'closed'
                        ? 'secondary'
                        : 'outline'
                    }
                  >
                    {caseItem.status}
                  </Badge>
                </div>
                {caseItem.notes && (
                  <CardDescription className="text-ink-muted">{caseItem.notes}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-ink-muted">
                    <Calendar className="w-4 h-4 mr-2" />
                    {new Date(caseItem.createdAt).toLocaleDateString()}
                  </div>
                  {caseItem.devicePassport && (
                    <div className="flex items-center text-ink-muted">
                      <Badge variant="outline" className="text-xs">
                        {caseItem.devicePassport.platform}
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateCaseDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCaseCreated={handleCaseCreated}
      />

      {selectedCaseId && (
        <CaseDetailsDialog
          caseId={selectedCaseId}
          open={showDetailsDialog}
          onClose={() => {
            setShowDetailsDialog(false);
            setSelectedCaseId(null);
          }}
        />
      )}
    </div>
  );
}