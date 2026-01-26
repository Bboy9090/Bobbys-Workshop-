/**
 * Waveform Visualizer
 * 
 * Real-time waveform display using Wavesurfer.js
 */

import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WaveformProps {
  audioUrl: string;
  className?: string;
}

export function Waveform({ audioUrl, className }: WaveformProps) {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    // Dynamically import Wavesurfer.js
    let wavesurfer: any = null;

    const initWaveform = async () => {
      try {
        // Try to import Wavesurfer.js
        const WaveSurferModule = await import('wavesurfer.js');
        const WaveSurfer = WaveSurferModule.default || (WaveSurferModule as any).WaveSurfer;
        
        if (!waveformRef.current || !WaveSurfer) {
          throw new Error('Wavesurfer not available');
        }

        wavesurfer = WaveSurfer.create({
          container: waveformRef.current,
          waveColor: '#22d3ee', // spray-cyan
          progressColor: '#f59e0b', // amber
          cursorColor: '#22d3ee',
          barWidth: 2,
          barRadius: 3,
          responsive: true,
          height: 100,
          normalize: true,
        });

        wavesurfer.load(audioUrl);

        wavesurfer.on('ready', () => {
          setDuration(wavesurfer.getDuration());
        });

        wavesurfer.on('play', () => setIsPlaying(true));
        wavesurfer.on('pause', () => setIsPlaying(false));
        wavesurfer.on('timeupdate', (time: number) => setCurrentTime(time));

        wavesurferRef.current = wavesurfer;
      } catch (error) {
        // Wavesurfer.js not available - show fallback
        if (waveformRef.current) {
          waveformRef.current.innerHTML = '<div class="text-center text-ink-muted p-8">Audio waveform visualization (install wavesurfer.js)</div>';
        }
      }
    };

    if (audioUrl) {
      initWaveform();
    }

    return () => {
      if (wavesurferRef.current) {
        try {
          wavesurferRef.current.destroy();
        } catch (e) {
          // Ignore cleanup errors
        }
        wavesurferRef.current = null;
      }
    };
  }, [audioUrl]);

  const handlePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePlayPause}
          className="p-2 rounded-lg bg-spray-cyan/20 border border-spray-cyan/30 text-spray-cyan hover:bg-spray-cyan/30 transition-colors"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>
        <div className="text-sm text-ink-muted font-mono">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      {/* Waveform */}
      <div
        ref={waveformRef}
        className="w-full rounded-lg bg-basement-concrete border border-panel p-4"
      />
    </div>
  );
}
