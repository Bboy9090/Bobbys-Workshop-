/**
 * Sonic Codex Job Library
 * 
 * Browse, search, filter, and manage all audio processing jobs.
 */

import React, { useState, useEffect } from 'react';
import { Search, Filter, Grid, List, Trash2, Eye, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/lib/app-context';
import { toast } from 'sonner';

interface JobLibraryProps {
  passcode?: string;
  onSelectJob?: (jobId: string) => void;
}

interface Job {
  job_id: string;
  status: string;
  progress: number;
  created_at: string;
  metadata?: {
    title?: string;
    device?: string;
    filename?: string;
  };
}

export function JobLibrary({ passcode, onSelectJob }: JobLibraryProps) {
  const { backendAvailable } = useApp();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const FASTAPI_URL = process.env.VITE_FASTAPI_URL || 'http://127.0.0.1:8000';

  useEffect(() => {
    if (passcode && backendAvailable) {
      loadJobs();
      // Refresh every 5 seconds
      const interval = setInterval(loadJobs, 5000);
      return () => clearInterval(interval);
    }
  }, [passcode, backendAvailable]);

  const loadJobs = async () => {
    if (!passcode) return;

    try {
      const response = await fetch(`${FASTAPI_URL}/api/v1/trapdoor/sonic/jobs`, {
        headers: {
          'X-Secret-Room-Passcode': passcode,
        },
      });

      const data = await response.json();
      if (data.ok && data.data?.jobs) {
        setJobs(data.data.jobs);
      }
    } catch (error) {
      toast.error('Failed to load jobs', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = !searchQuery || 
      job.metadata?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.metadata?.device?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.job_id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleDelete = async (jobId: string) => {
    if (!confirm('Delete this job? This action cannot be undone.')) return;
    
    if (!passcode) return;
    
    try {
      const FASTAPI_URL = process.env.VITE_FASTAPI_URL || 'http://127.0.0.1:8000';
      const response = await fetch(`${FASTAPI_URL}/api/v1/trapdoor/sonic/jobs/${jobId}`, {
        method: 'DELETE',
        headers: {
          'X-Secret-Room-Passcode': passcode,
        },
      });

      const data = await response.json();
      if (data.ok) {
        toast.success('Job deleted successfully');
        loadJobs();
      } else {
        toast.error('Failed to delete job', {
          description: data.error?.message || 'Unknown error'
        });
      }
    } catch (error) {
      toast.error('Failed to delete job', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-ink-muted">Loading jobs...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-panel">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-ink-primary">Job Library</h1>
            <p className="text-sm text-ink-muted">{filteredJobs.length} jobs</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-2 rounded-lg border transition-colors",
                viewMode === 'grid'
                  ? "bg-workbench-steel border-spray-cyan text-spray-cyan"
                  : "bg-basement-concrete border-panel text-ink-muted hover:text-ink-primary"
              )}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2 rounded-lg border transition-colors",
                viewMode === 'list'
                  ? "bg-workbench-steel border-spray-cyan text-spray-cyan"
                  : "bg-basement-concrete border-panel text-ink-muted hover:text-ink-primary"
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search jobs..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-basement-concrete border border-panel text-ink-primary"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 rounded-lg bg-basement-concrete border border-panel text-ink-primary"
          >
            <option value="all">All Status</option>
            <option value="complete">Complete</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Jobs List/Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredJobs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-ink-muted mb-2">No jobs found</p>
              <p className="text-sm text-ink-muted">Upload audio to get started</p>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredJobs.map((job) => (
              <JobCard
                key={job.job_id}
                job={job}
                onSelect={() => onSelectJob?.(job.job_id)}
                onDelete={() => handleDelete(job.job_id)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredJobs.map((job) => (
              <JobListItem
                key={job.job_id}
                job={job}
                onSelect={() => onSelectJob?.(job.job_id)}
                onDelete={() => handleDelete(job.job_id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function JobCard({ job, onSelect, onDelete }: { job: Job; onSelect: () => void; onDelete: () => void }) {
  const statusColors = {
    complete: 'bg-state-ready/20 text-state-ready border-state-ready/30',
    processing: 'bg-state-warning/20 text-state-warning border-state-warning/30',
    failed: 'bg-state-danger/20 text-state-danger border-state-danger/30',
  };

  return (
    <div className="p-4 rounded-lg bg-workbench-steel border border-panel hover:border-spray-cyan/30 transition-all">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="font-medium text-ink-primary mb-1">
            {job.metadata?.title || job.metadata?.filename || job.job_id.slice(0, 8)}
          </h3>
          <p className="text-xs text-ink-muted">{job.metadata?.device || 'Unknown device'}</p>
        </div>
        <span className={cn(
          "text-xs px-2 py-1 rounded border",
          statusColors[job.status as keyof typeof statusColors] || statusColors.processing
        )}>
          {job.status}
        </span>
      </div>

      <div className="flex items-center justify-between mt-4">
        <span className="text-xs text-ink-muted">
          {new Date(job.created_at).toLocaleDateString()}
        </span>
        <div className="flex items-center gap-2">
          {job.status === 'complete' && (
            <button
              onClick={onSelect}
              className="p-1.5 rounded hover:bg-spray-cyan/20 text-spray-cyan transition-colors"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1.5 rounded hover:bg-state-danger/20 text-state-danger transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {job.status === 'processing' && (
        <div className="mt-2">
          <div className="w-full h-1 bg-basement-concrete rounded-full overflow-hidden">
            <div
              className="h-full bg-spray-cyan transition-all"
              style={{ width: `${job.progress || 0}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function JobListItem({ job, onSelect, onDelete }: { job: Job; onSelect: () => void; onDelete: () => void }) {
  return (
    <div className="p-4 rounded-lg bg-workbench-steel border border-panel hover:border-spray-cyan/30 transition-all flex items-center justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <h3 className="font-medium text-ink-primary">
            {job.metadata?.title || job.metadata?.filename || job.job_id.slice(0, 8)}
          </h3>
          <span className="text-xs text-ink-muted">{job.status}</span>
        </div>
        <p className="text-sm text-ink-muted mt-1">
          {job.metadata?.device || 'Unknown'} • {new Date(job.created_at).toLocaleString()}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {job.status === 'complete' && (
          <button
            onClick={onSelect}
            className="px-3 py-1.5 rounded-lg bg-spray-cyan/20 border border-spray-cyan/30 text-spray-cyan hover:bg-spray-cyan/30 transition-colors"
          >
            View
          </button>
        )}
        <button
          onClick={onDelete}
          className="p-1.5 rounded hover:bg-state-danger/20 text-state-danger transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
