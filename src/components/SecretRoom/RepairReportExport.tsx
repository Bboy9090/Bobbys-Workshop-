import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileJson } from 'lucide-react';
import { toast } from 'sonner';

interface RepairReportExportProps {
  caseId?: string;
}

export const RepairReportExport: React.FC<RepairReportExportProps> = ({ caseId }) => {
  const handleExportJson = async () => {
    if (!caseId) {
      toast.error('Select a case before exporting a report.');
      return;
    }

    try {
      const response = await fetch(`/api/v1/cases/${caseId}/report`);
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message || 'Report export failed');
      }

      const blob = new Blob([JSON.stringify(payload.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `case-${caseId}-report.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Report exported');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Report export failed');
    }
  };

  return (
    <div className="flex gap-2">
      <Button disabled variant="secondary" size="sm" title="PDF export requires backend support">
        <Download className="h-4 w-4 mr-2" />
        Export PDF
      </Button>
      <Button variant="ghost" size="sm" onClick={handleExportJson}>
        <FileJson className="h-4 w-4 mr-2" />
        Export JSON
      </Button>
    </div>
  );
};
