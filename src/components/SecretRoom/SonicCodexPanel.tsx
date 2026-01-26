/**
 * Sonic Codex Panel - Secret Room #8
 * Audio processing, transcription, and enhancement
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Mic, FileAudio, Link, Download, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';

export const SonicCodexPanel: React.FC = () => {
  const [activeJob, setActiveJob] = useState<string | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadJobs = async () => {
    try {
      const passcode = localStorage.getItem('trapdoor-passcode') || localStorage.getItem('bobbysWorkshop.secretRoomPasscode') || '';
      const response = await fetch('/api/v1/trapdoor/sonic/jobs', {
        headers: {
          'X-Secret-Room-Passcode': passcode
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.data && data.data.jobs) {
          setJobs(data.data.jobs);
        }
      }
    } catch (error) {
      console.error('Failed to load jobs:', error);
    }
  };

  const handleCaptureStart = async () => {
    setIsLoading(true);
    try {
      const passcode = localStorage.getItem('trapdoor-passcode') || localStorage.getItem('bobbysWorkshop.secretRoomPasscode') || '';
      const response = await fetch('/api/v1/trapdoor/sonic/capture/start', {
        method: 'POST',
        headers: {
          'X-Secret-Room-Passcode': passcode,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ duration: 60 })
      });
      const data = await response.json();
      if (data.ok || data.data) {
        const jobId = data.data?.jobId || data.jobId;
        if (jobId) {
          setActiveJob(jobId);
          loadJobs(); // Refresh jobs list
        }
      }
    } catch (error) {
      console.error('Capture failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (jobId: string) => {
    const passcode = localStorage.getItem('trapdoor-passcode') || localStorage.getItem('bobbysWorkshop.secretRoomPasscode') || '';
    const url = `/api/v1/trapdoor/sonic/jobs/${jobId}/download`;
    
    // Create a temporary link to download with auth header
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sonic-job-${jobId}.zip`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <Alert className="bg-[#141922] border-[#2FD3FF]/50">
        <Mic className="h-4 w-4 text-[#2FD3FF]" />
        <AlertDescription className="text-gray-300">
          <strong className="text-[#2FD3FF]">Sonic Codex</strong> - Audio capture, enhancement, transcription, and export.
          Proxies to FastAPI backend.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="capture" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-[#141922]">
          <TabsTrigger value="capture">Capture</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="capture" className="space-y-4">
          <Card className="bg-[#141922] border-[#2FD3FF]/20">
            <CardHeader>
              <CardTitle className="text-white">Audio Capture</CardTitle>
              <CardDescription className="text-gray-400">
                Capture audio from live source, file, or URL
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Button
                  onClick={handleCaptureStart}
                  disabled={isLoading}
                  className="bg-[#2FD3FF] hover:bg-[#2FD3FF]/80 text-black"
                >
                  {isLoading ? <Loader2 className="animate-spin mr-2" /> : <Mic className="mr-2" />}
                  Live Capture
                </Button>
                <Button variant="outline" className="border-[#2FD3FF]/50">
                  <FileAudio className="mr-2" />
                  Upload File
                </Button>
                <Button variant="outline" className="border-[#2FD3FF]/50">
                  <Link className="mr-2" />
                  From URL
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
          <Card className="bg-[#141922] border-[#2FD3FF]/20">
            <CardHeader>
              <CardTitle className="text-white">Active Jobs</CardTitle>
              <CardDescription className="text-gray-400">
                View and manage audio processing jobs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {jobs.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No active jobs</p>
              ) : (
                <div className="space-y-2">
                  {jobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between p-3 bg-[#0B0F14] rounded">
                      <div>
                        <p className="text-white">{job.name}</p>
                        <p className="text-sm text-gray-400">{job.status}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleDownload(job.id)}
                        className="bg-[#2FD3FF] hover:bg-[#2FD3FF]/80 text-black"
                      >
                        <Download className="mr-2" />
                        Download
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card className="bg-[#141922] border-[#2FD3FF]/20">
            <CardHeader>
              <CardTitle className="text-white">Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-400">Settings coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
