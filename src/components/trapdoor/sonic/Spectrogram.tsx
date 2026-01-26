/**
 * Spectrogram Component
 * 
 * Visualize audio frequencies using Canvas.
 */

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface SpectrogramProps {
  audioUrl: string;
  className?: string;
}

export function Spectrogram({ audioUrl, className }: SpectrogramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = 200;

    // Load audio and create spectrogram
    const audio = new Audio(audioUrl);
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaElementSource(audio);

    analyser.fftSize = 2048;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    source.connect(analyser);
    analyser.connect(audioContext.destination);

    // Draw spectrogram
    const draw = () => {
      requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;

        // Color gradient: cyan for speech range (2-8kHz)
        const hue = 180 + (i / bufferLength) * 60; // Cyan to green
        const saturation = 70;
        const lightness = 30 + (dataArray[i] / 255) * 40;

        ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth;
      }
    };

    audio.addEventListener('loadeddata', () => {
      setIsLoading(false);
      draw();
    });

    return () => {
      audio.pause();
      audioContext.close();
    };
  }, [audioUrl]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="text-sm font-medium text-ink-primary">Spectrogram</div>
      <div className="relative rounded-lg bg-basement-concrete border border-panel overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-sm text-ink-muted">Loading spectrogram...</div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="w-full h-48"
        />
      </div>
      <div className="flex items-center justify-between text-xs text-ink-muted">
        <span>Low Frequency</span>
        <span className="text-spray-cyan">Speech Range (2-8kHz)</span>
        <span>High Frequency</span>
      </div>
    </div>
  );
}
