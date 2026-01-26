/**
 * Sonic Codex Wizard Flow
 * 
 * 6-step wizard for audio processing:
 * 1. Import (File/URL/Capture)
 * 2. Metadata (Title, Device, Date, Notes)
 * 3. Enhancement (Preset selection)
 * 4. Transcribe (Language + processing)
 * 5. Review (Playback + transcript)
 * 6. Export (Package download)
 */

import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, Upload, Link, Mic, FileText, Settings, Eye, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/lib/app-context';
import { toast } from 'sonner';

interface WizardFlowProps {
  passcode?: string;
  onComplete?: (jobId: string) => void;
}

type Step = 1 | 2 | 3 | 4 | 5 | 6;
type InputMethod = 'file' | 'url' | 'capture';

export function WizardFlow({ passcode, onComplete }: WizardFlowProps) {
  const { backendAvailable } = useApp();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [inputMethod, setInputMethod] = useState<InputMethod>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [metadata, setMetadata] = useState({
    title: '',
    device: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [preset, setPreset] = useState('forensic');
  const [jobId, setJobId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [transcript, setTranscript] = useState<string | null>(null);

  const FASTAPI_URL = process.env.VITE_FASTAPI_URL || 'http://127.0.0.1:8000';

  const handleNext = async () => {
    if (currentStep === 1) {
      // Validate input
      if (inputMethod === 'file' && !selectedFile) return;
      if (inputMethod === 'url' && !url.trim()) return;
      
      // Upload/Extract
      await handleImport();
      if (jobId) setCurrentStep(2);
    } else if (currentStep === 2) {
      // Validate metadata
      if (!metadata.title.trim()) return;
      setCurrentStep(3);
    } else if (currentStep === 3) {
      setCurrentStep(4);
      // Start processing
      await startProcessing();
    } else if (currentStep === 4) {
      // Wait for processing to complete
      if (transcript) setCurrentStep(5);
    } else if (currentStep === 5) {
      setCurrentStep(6);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as Step);
    }
  };

  const handleImport = async () => {
    if (!passcode || !backendAvailable) return;

    setIsProcessing(true);

    try {
      if (inputMethod === 'file' && selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('enhancement_preset', preset);

        const response = await fetch(`${FASTAPI_URL}/api/v1/trapdoor/sonic/upload`, {
          method: 'POST',
          headers: {
            'X-Secret-Room-Passcode': passcode,
          },
          body: formData,
        });

        const data = await response.json();
        if (data.ok && data.data?.job_id) {
          setJobId(data.data.job_id);
        }
      } else if (inputMethod === 'url' && url) {
        const response = await fetch(`${FASTAPI_URL}/api/v1/trapdoor/sonic/extract-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Secret-Room-Passcode': passcode,
          },
          body: JSON.stringify({ url }),
        });

        const data = await response.json();
        if (data.ok && data.data?.job_id) {
          setJobId(data.data.job_id);
        }
      }
    } catch (error) {
      console.error('Import error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const startProcessing = async () => {
    if (!jobId || !passcode) return;

    setIsProcessing(true);
    setProgress(0);

    // Poll for job status
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${FASTAPI_URL}/api/v1/trapdoor/sonic/jobs/${jobId}`, {
          headers: {
            'X-Secret-Room-Passcode': passcode,
          },
        });

        const data = await response.json();
        if (data.ok && data.data) {
          setProgress(data.data.progress || 0);
          
          if (data.data.status === 'complete') {
            clearInterval(interval);
            setIsProcessing(false);
            setTranscript(data.data.transcript || '');
            setCurrentStep(5);
          } else if (data.data.status === 'failed') {
            clearInterval(interval);
            setIsProcessing(false);
            alert('Processing failed: ' + (data.data.error || 'Unknown error'));
          }
        }
      } catch (error) {
        // Silent error - polling will retry
        // Only show error if it's a critical failure
      }
    }, 1000);
  };

  const handleDownload = async () => {
    if (!jobId || !passcode) return;

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

  const steps = [
    { number: 1, title: 'Import', icon: Upload },
    { number: 2, title: 'Metadata', icon: FileText },
    { number: 3, title: 'Enhance', icon: Settings },
    { number: 4, title: 'Transcribe', icon: FileText },
    { number: 5, title: 'Review', icon: Eye },
    { number: 6, title: 'Export', icon: Download },
  ];

  return (
    <div className="flex flex-col h-full bg-basement-concrete">
      {/* Progress Bar */}
      <div className="h-1 bg-basement-concrete">
        <div
          className="h-full bg-spray-cyan transition-all duration-300"
          style={{ width: `${((currentStep - 1) / 5) * 100}%` }}
        />
      </div>

      {/* Step Indicator */}
      <div className="p-6 border-b border-panel">
        <div className="flex items-center justify-between">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = currentStep === step.number;
            const isComplete = currentStep > step.number;

            return (
              <React.Fragment key={step.number}>
                <div className="flex items-center">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                      isActive
                        ? "bg-spray-cyan/20 border-spray-cyan text-spray-cyan"
                        : isComplete
                        ? "bg-state-ready/20 border-state-ready text-state-ready"
                        : "bg-basement-concrete border-panel text-ink-muted"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={cn(
                    "ml-2 text-sm font-medium",
                    isActive ? "text-ink-primary" : "text-ink-muted"
                  )}>
                    {step.title}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={cn(
                    "flex-1 h-0.5 mx-4",
                    isComplete ? "bg-state-ready" : "bg-panel"
                  )} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Step 1: Import */}
        {currentStep === 1 && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-ink-primary mb-2">Import Audio</h2>
              <p className="text-ink-muted">Choose how to import your audio</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => setInputMethod('file')}
                className={cn(
                  "p-6 rounded-lg border transition-all",
                  inputMethod === 'file'
                    ? "bg-workbench-steel border-spray-cyan glow-cyan"
                    : "bg-basement-concrete border-panel hover:border-spray-cyan/30"
                )}
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-ink-primary" />
                <div className="text-sm font-medium text-ink-primary">File Upload</div>
              </button>

              <button
                onClick={() => setInputMethod('url')}
                className={cn(
                  "p-6 rounded-lg border transition-all",
                  inputMethod === 'url'
                    ? "bg-workbench-steel border-spray-cyan glow-cyan"
                    : "bg-basement-concrete border-panel hover:border-spray-cyan/30"
                )}
              >
                <Link className="w-8 h-8 mx-auto mb-2 text-ink-primary" />
                <div className="text-sm font-medium text-ink-primary">URL Pull</div>
              </button>

              <button
                onClick={() => setInputMethod('capture')}
                className={cn(
                  "p-6 rounded-lg border transition-all",
                  inputMethod === 'capture'
                    ? "bg-workbench-steel border-spray-cyan glow-cyan"
                    : "bg-basement-concrete border-panel hover:border-spray-cyan/30"
                )}
              >
                <Mic className="w-8 h-8 mx-auto mb-2 text-ink-primary" />
                <div className="text-sm font-medium text-ink-primary">Live Capture</div>
              </button>
            </div>

            {inputMethod === 'file' && (
              <div className="p-6 rounded-lg bg-workbench-steel border border-panel">
                <input
                  type="file"
                  accept="audio/*,video/*"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 rounded-lg bg-basement-concrete border border-panel text-ink-primary"
                />
                {selectedFile && (
                  <p className="mt-2 text-sm text-ink-muted">Selected: {selectedFile.name}</p>
                )}
              </div>
            )}

            {inputMethod === 'url' && (
              <div className="p-6 rounded-lg bg-workbench-steel border border-panel">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full px-4 py-2 rounded-lg bg-basement-concrete border border-panel text-ink-primary"
                />
              </div>
            )}

            {inputMethod === 'capture' && (
              <div className="p-6 rounded-lg bg-workbench-steel border border-panel">
                <p className="text-ink-muted">Live capture coming soon</p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Metadata */}
        {currentStep === 2 && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-ink-primary mb-2">Metadata</h2>
              <p className="text-ink-muted">Add information about this recording</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-primary mb-2">Title *</label>
                <input
                  type="text"
                  value={metadata.title}
                  onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
                  placeholder="Project Aegis Draft"
                  className="w-full px-4 py-2 rounded-lg bg-basement-concrete border border-panel text-ink-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-primary mb-2">Device</label>
                <input
                  type="text"
                  value={metadata.device}
                  onChange={(e) => setMetadata({ ...metadata, device: e.target.value })}
                  placeholder="iPhone 13 Pro"
                  className="w-full px-4 py-2 rounded-lg bg-basement-concrete border border-panel text-ink-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-primary mb-2">Date</label>
                <input
                  type="date"
                  value={metadata.date}
                  onChange={(e) => setMetadata({ ...metadata, date: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-basement-concrete border border-panel text-ink-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-primary mb-2">Notes</label>
                <textarea
                  value={metadata.notes}
                  onChange={(e) => setMetadata({ ...metadata, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={4}
                  className="w-full px-4 py-2 rounded-lg bg-basement-concrete border border-panel text-ink-primary"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Enhancement */}
        {currentStep === 3 && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-ink-primary mb-2">Enhancement</h2>
              <p className="text-ink-muted">Select enhancement preset</p>
            </div>

            <div className="space-y-2">
              {['forensic', 'conversation', 'light'].map((p) => (
                <button
                  key={p}
                  onClick={() => setPreset(p)}
                  className={cn(
                    "w-full p-4 rounded-lg border text-left transition-all",
                    preset === p
                      ? "bg-workbench-steel border-spray-cyan glow-cyan"
                      : "bg-basement-concrete border-panel hover:border-spray-cyan/30"
                  )}
                >
                  <div className="font-medium text-ink-primary capitalize">{p}</div>
                  <div className="text-sm text-ink-muted">
                    {p === 'forensic' && 'Maximum clarity for forensic analysis'}
                    {p === 'conversation' && 'Optimized for conversation clarity'}
                    {p === 'light' && 'Light noise reduction'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Transcribe */}
        {currentStep === 4 && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-ink-primary mb-2">Transcribing</h2>
              <p className="text-ink-muted">Processing your audio...</p>
            </div>

            {isProcessing && (
              <div className="p-6 rounded-lg bg-workbench-steel border border-panel">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-ink-primary">Processing...</span>
                  <span className="text-sm text-ink-muted">{progress}%</span>
                </div>
                <div className="w-full h-2 bg-basement-concrete rounded-full overflow-hidden">
                  <div
                    className="h-full bg-spray-cyan transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {transcript && (
              <div className="p-6 rounded-lg bg-workbench-steel border border-panel">
                <p className="text-sm text-ink-primary whitespace-pre-wrap">{transcript}</p>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Review */}
        {currentStep === 5 && transcript && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-ink-primary mb-2">Review</h2>
              <p className="text-ink-muted">Review your transcript</p>
            </div>

            <div className="p-6 rounded-lg bg-workbench-steel border border-panel">
              <div className="p-4 rounded bg-basement-concrete border border-panel">
                <p className="text-sm text-ink-primary whitespace-pre-wrap">{transcript}</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 6: Export */}
        {currentStep === 6 && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-ink-primary mb-2">Export</h2>
              <p className="text-ink-muted">Download your forensic package</p>
            </div>

            <div className="p-6 rounded-lg bg-workbench-steel border border-panel">
              <button
                onClick={handleDownload}
                className="w-full px-4 py-3 rounded-lg bg-spray-cyan/20 border border-spray-cyan/30 text-spray-cyan hover:bg-spray-cyan/30 transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download Forensic Package
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="p-6 border-t border-panel flex items-center justify-between">
        <button
          onClick={handleBack}
          disabled={currentStep === 1}
          className={cn(
            "px-4 py-2 rounded-lg border transition-colors flex items-center gap-2",
            currentStep === 1
              ? "bg-basement-concrete border-panel text-ink-muted opacity-50 cursor-not-allowed"
              : "bg-workbench-steel border-panel text-ink-primary hover:border-spray-cyan/30"
          )}
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <button
          onClick={handleNext}
          disabled={isProcessing && currentStep === 4}
          className={cn(
            "px-4 py-2 rounded-lg border transition-colors flex items-center gap-2",
            isProcessing && currentStep === 4
              ? "bg-basement-concrete border-panel text-ink-muted opacity-50 cursor-not-allowed"
              : "bg-spray-cyan/20 border-spray-cyan/30 text-spray-cyan hover:bg-spray-cyan/30"
          )}
        >
          {currentStep === 6 ? 'Complete' : 'Next'}
          {currentStep < 6 && <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
