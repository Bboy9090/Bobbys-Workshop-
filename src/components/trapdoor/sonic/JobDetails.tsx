/**
 * Sonic Codex Job Details
 * 
 * Review job, view transcript, play audio, export package.
 */

import React, { useState, useEffect } from 'react';
import { Download, FileText, Music, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/lib/app-context';
import { toast } from 'sonner';
import { Waveform } from './Waveform';
import { Spectrogram } from './Spectrogram';
import { AudioComparison } from './AudioComparison';

interface JobDetailsProps {
  jobId: string;
  passcode?: string;
  onBack?: () => void;
}

export function JobDetails({ jobId, passcode, onBack }: JobDetailsProps) {
  const { backendAvailable } = useApp();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcriptView, setTranscriptView] = useState<'original' | 'english' | 'dual'>('english');

  const FASTAPI_URL = process.env.VITE_FASTAPI_URL || 'http://127.0.0.1:8000';

  useEffect(() => {
    if (passcode && backendAvailable) {
      loadJob();
      // Refresh every 2 seconds if processing
      const interval = setInterval(() => {
        if (job?.status === 'processing') {
          loadJob();
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [jobId, passcode, backendAvailable]);

  const loadJob = async () => {
    if (!passcode) return;

    try {
      const response = await fetch(`${FASTAPI_URL}/api/v1/trapdoor/sonic/jobs/${jobId}`, {
        headers: {
          'X-Secret-Room-Passcode': passcode,
        },
      });

      const data = await response.json();
      if (data.ok && data.data) {
        setJob(data.data);
      }
    } catch (error) {
      console.error('Load job error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!passcode) return;

    try {
      const response = await fetch(`${FASTAPI_URL}/api/v1/trapdoor/sonic/jobs/${jobId}/download`, {
        headers: {
          'X-Secret-Room-Passcode': passcode,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${jobId}_FORENSIC_PACKAGE.zip`;
        a.click();
      }
    } catch (error) {
      toast.error('Download failed', {
        description: error instanceof Error ? error.message : 'Failed to download package'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-ink-muted">Loading job...</div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-ink-muted mb-2">Job not found</p>
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 rounded-lg bg-spray-cyan/20 border border-spray-cyan/30 text-spray-cyan hover:bg-spray-cyan/30 transition-colors"
            >
              Back to Library
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-panel">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-lg hover:bg-workbench-steel transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-ink-primary" />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-ink-primary">
                {job.metadata?.title || job.metadata?.filename || job.job_id.slice(0, 8)}
              </h1>
              <p className="text-sm text-ink-muted">
                {job.metadata?.device || 'Unknown device'} • {new Date(job.created_at).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-xs px-2 py-1 rounded border",
              job.status === 'complete' && "bg-state-ready/20 text-state-ready border-state-ready/30",
              job.status === 'processing' && "bg-state-warning/20 text-state-warning border-state-warning/30",
              job.status === 'failed' && "bg-state-danger/20 text-state-danger border-state-danger/30"
            )}>
              {job.status}
            </span>
            {job.status === 'complete' && (
              <button
                onClick={handleDownload}
                className="px-4 py-2 rounded-lg bg-spray-cyan/20 border border-spray-cyan/30 text-spray-cyan hover:bg-spray-cyan/30 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Package
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Audio Player */}
          {job.status === 'complete' && (
            <div className="p-6 rounded-lg bg-workbench-steel border border-panel space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-ink-primary flex items-center gap-2">
                  <Music className="w-5 h-5" />
                  Audio
                </h2>
              </div>
              
              {/* Audio Comparison (if both original and enhanced exist) */}
              {job.enhanced_path && (
                <AudioComparison
                  originalUrl={`${FASTAPI_URL}/api/v1/trapdoor/sonic/jobs/${jobId}/audio`}
                  enhancedUrl={`${FASTAPI_URL}/api/v1/trapdoor/sonic/jobs/${jobId}/audio?path=${encodeURIComponent(job.enhanced_path)}`}
                />
              )}

              {/* Waveform (if only one audio file) */}
              {!job.enhanced_path && (
                <Waveform
                  audioUrl={`${FASTAPI_URL}/api/v1/trapdoor/sonic/jobs/${jobId}/audio`}
                />
              )}

              {/* Spectrogram */}
              {job.enhanced_path && (
                <Spectrogram
                  audioUrl={`${FASTAPI_URL}/api/v1/trapdoor/sonic/jobs/${jobId}/audio?path=${encodeURIComponent(job.enhanced_path)}`}
                />
              )}
            </div>
          )}

          {/* Transcript */}
          {job.transcript && (
            <div className="p-6 rounded-lg bg-workbench-steel border border-panel">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-ink-primary flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Transcript
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTranscriptView('english')}
                    className={cn(
                      "px-3 py-1 rounded text-sm transition-colors",
                      transcriptView === 'english'
                        ? "bg-spray-cyan/20 border border-spray-cyan/30 text-spray-cyan"
                        : "bg-basement-concrete border border-panel text-ink-muted hover:text-ink-primary"
                    )}
                  >
                    English
                  </button>
                  <button
                    onClick={() => setTranscriptView('original')}
                    className={cn(
                      "px-3 py-1 rounded text-sm transition-colors",
                      transcriptView === 'original'
                        ? "bg-spray-cyan/20 border border-spray-cyan/30 text-spray-cyan"
                        : "bg-basement-concrete border border-panel text-ink-muted hover:text-ink-primary"
                    )}
                  >
                    Original
                  </button>
                </div>
              </div>
              <div className="p-4 rounded bg-basement-concrete border border-panel">
                <p className="text-sm text-ink-primary whitespace-pre-wrap">
                  {job.transcript}
                </p>
              </div>
              {job.language && (
                <p className="mt-2 text-xs text-ink-muted">
                  Detected language: {job.language}
                </p>
              )}
            </div>
          )}

          {/* Processing Status */}
          {job.status === 'processing' && (
            <div className="p-6 rounded-lg bg-workbench-steel border border-panel">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-ink-primary">Processing...</span>
                <span className="text-sm text-ink-muted">{job.progress || 0}%</span>
              </div>
              <div className="w-full h-2 bg-basement-concrete rounded-full overflow-hidden">
                <div
                  className="h-full bg-spray-cyan transition-all duration-300"
                  style={{ width: `${job.progress || 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Job Info */}
          <div className="p-6 rounded-lg bg-workbench-steel border border-panel">
            <h2 className="text-lg font-medium text-ink-primary mb-4">Job Information</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-muted">Job ID:</span>
                <span className="text-ink-primary font-mono">{job.job_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Status:</span>
                <span className="text-ink-primary">{job.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Created:</span>
                <span className="text-ink-primary">{new Date(job.created_at).toLocaleString()}</span>
              </div>
              {job.metadata?.title && (
                <div className="flex justify-between">
                  <span className="text-ink-muted">Title:</span>
                  <span className="text-ink-primary">{job.metadata.title}</span>
                </div>
              )}
              {job.metadata?.device && (
                <div className="flex justify-between">
                  <span className="text-ink-muted">Device:</span>
                  <span className="text-ink-primary">{job.metadata.device}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
