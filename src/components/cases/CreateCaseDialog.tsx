/**
 * CreateCaseDialog Component
 * 
 * Dialog for creating a new case
 */

import { useState } from 'react';
// Using inline modal pattern (matching ConfirmationDialog style)
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCases, type Case } from '@/hooks/use-cases';
import { toast } from 'sonner';

interface CreateCaseDialogProps {
  open: boolean;
  onClose: () => void;
  onCaseCreated: (caseItem: Case) => void;
}

export function CreateCaseDialog({ open, onClose, onCaseCreated }: CreateCaseDialogProps) {
  const { createCase, loading } = useCases();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    const newCase = await createCase({
      title: title.trim(),
      notes: notes.trim() || undefined,
    });

    if (newCase) {
      toast.success('Case created successfully');
      onCaseCreated(newCase);
      setTitle('');
      setNotes('');
    }
  };

  const handleClose = () => {
    if (!loading) {
      setTitle('');
      setNotes('');
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
      <div
        className="bg-workbench-steel border border-panel rounded-lg shadow-lg w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-panel">
          <h2 className="text-xl font-bold text-ink-primary">Create New Case</h2>
          <p className="text-sm text-ink-muted mt-1">Create a new case for device repair or service</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium text-ink-primary block">
                Title <span className="text-state-danger">*</span>
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., iPhone 12 Screen Repair"
                className="w-full px-3 py-2 bg-midnight-room border border-panel rounded text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-spray-cyan/50"
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="notes" className="text-sm font-medium text-ink-primary block">
                Notes
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional information about this case..."
                className="w-full px-3 py-2 bg-midnight-room border border-panel rounded text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-spray-cyan/50 min-h-[100px] resize-y"
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="border-panel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !title.trim()}
              className="bg-spray-cyan/20 text-spray-cyan border border-spray-cyan/50 hover:bg-spray-cyan/30"
            >
              {loading ? 'Creating...' : 'Create Case'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
