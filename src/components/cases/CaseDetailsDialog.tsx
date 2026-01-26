/**
 * CaseDetailsDialog Component
 * 
 * Dialog for viewing case details and actions
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCases, type Case } from '@/hooks/use-cases';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar, User, FileText, Shield, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CaseDetailsDialogProps {
  caseId: string;
  open: boolean;
  onClose: () => void;
}

export function CaseDetailsDialog({ caseId, open, onClose }: CaseDetailsDialogProps) {
  const { getCase, getCaseAudit, loading } = useCases();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  useEffect(() => {
    if (open && caseId) {
      loadCase();
      loadAudit();
    }
  }, [open, caseId]);

  const loadCase = async () => {
    const caseItem = await getCase(caseId);
    if (caseItem) {
      setCaseData(caseItem);
    } else {
      setError('Failed to load case');
    }
  };

  const loadAudit = async () => {
    setLoadingAudit(true);
    const events = await getCaseAudit(caseId);
    if (events) {
      setAuditEvents(events);
    }
    setLoadingAudit(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-workbench-steel border border-panel rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-panel">
          <h2 className="text-xl font-bold text-ink-primary">Case Details</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-ink-muted hover:text-ink-primary"
          >
            ✕
          </Button>
        </div>

        <ScrollArea className="flex-1 p-6">
          {loading && !caseData ? (
            <LoadingState message="Loading case..." />
          ) : error || !caseData ? (
            <ErrorState
              title="Failed to load case"
              message={error || 'Case not found'}
              action={{
                label: "Retry",
                onClick: loadCase
              }}
            />
          ) : (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-midnight-room">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="device">Device</TabsTrigger>
                <TabsTrigger value="audit">Audit Log</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-ink-primary mb-2">{caseData.title}</h3>
                    {caseData.notes && (
                      <p className="text-sm text-ink-muted">{caseData.notes}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-ink-muted">
                        <Badge
                          variant={
                            caseData.status === 'open'
                              ? 'default'
                              : caseData.status === 'closed'
                              ? 'secondary'
                              : 'outline'
                          }
                          className="mr-2"
                        >
                          {caseData.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-ink-muted">
                        <Calendar className="w-4 h-4 mr-2" />
                        Created: {new Date(caseData.createdAt).toLocaleString()}
                      </div>
                      <div className="flex items-center text-sm text-ink-muted">
                        <User className="w-4 h-4 mr-2" />
                        User: {caseData.userId}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="device" className="space-y-4 mt-4">
                {caseData.devicePassport ? (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-ink-primary mb-2">Device Passport</h4>
                      <div className="bg-midnight-room border border-panel rounded p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-ink-muted">Platform:</span>
                          <Badge variant="outline">{caseData.devicePassport.platform}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-ink-muted">Connection:</span>
                          <Badge variant="outline">{caseData.devicePassport.connectionState}</Badge>
                        </div>
                        {caseData.devicePassport.deviceInfo && (
                          <div className="mt-4">
                            <pre className="text-xs text-ink-muted bg-midnight-room p-2 rounded overflow-auto">
                              {JSON.stringify(caseData.devicePassport.deviceInfo, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>

                    {caseData.ownershipVerification && (
                      <div>
                        <h4 className="text-sm font-semibold text-ink-primary mb-2 flex items-center">
                          <Shield className="w-4 h-4 mr-2" />
                          Ownership Verification
                        </h4>
                        <div className="bg-midnight-room border border-panel rounded p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-ink-muted">Verified:</span>
                            <Badge variant={caseData.ownershipVerification.checkboxConfirmed ? 'default' : 'outline'}>
                              {caseData.ownershipVerification.checkboxConfirmed ? 'Confirmed' : 'Pending'}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-ink-muted">Verified At:</span>
                            <span className="text-sm text-ink-primary">
                              {new Date(caseData.ownershipVerification.verifiedAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-ink-muted">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No device passport available</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="audit" className="space-y-4 mt-4">
                {loadingAudit ? (
                  <LoadingState message="Loading audit log..." />
                ) : auditEvents.length === 0 ? (
                  <div className="text-center py-8 text-ink-muted">
                    <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No audit events</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {auditEvents.map((event, index) => (
                      <div
                        key={index}
                        className="bg-midnight-room border border-panel rounded p-4 text-sm"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-ink-primary">{event.actionId}</span>
                          <span className="text-xs text-ink-muted">{new Date(event.timestamp).toLocaleString()}</span>
                        </div>
                        {event.stdout && (
                          <pre className="text-xs text-ink-muted mt-2 overflow-auto">
                            {typeof event.stdout === 'string' ? event.stdout : JSON.stringify(event.stdout, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
