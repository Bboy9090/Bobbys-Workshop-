"""
Audio Capture Module
Live audio capture from microphone.
"""

import pyaudio
import wave
import threading
from typing import Optional


class AudioCapture:
    """Handles live audio capture."""
    
    def __init__(self, sample_rate: int = 44100, channels: int = 1, chunk_size: int = 1024):
        self.sample_rate = sample_rate
        self.channels = channels
        self.chunk_size = chunk_size
        self.audio = pyaudio.PyAudio()
        self.stream: Optional[pyaudio.Stream] = None
        self.is_recording = False
        self.frames = []
    
    def start_capture(self, duration: Optional[int] = None):
        """Start capturing audio."""
        if self.is_recording:
            raise RuntimeError("Capture already in progress")
        
        self.frames = []
        self.is_recording = True
        
        self.stream = self.audio.open(
            format=pyaudio.paInt16,
            channels=self.channels,
            rate=self.sample_rate,
            input=True,
            frames_per_buffer=self.chunk_size
        )
        
        def record():
            try:
                while self.is_recording:
                    data = self.stream.read(self.chunk_size, exception_on_overflow=False)
                    self.frames.append(data)
            except Exception as e:
                print(f"Capture error: {e}")
        
        self.record_thread = threading.Thread(target=record, daemon=True)
        self.record_thread.start()
    
    def stop_capture(self) -> bytes:
        """Stop capturing and return audio data."""
        self.is_recording = False
        
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
            self.stream = None
        
        return b''.join(self.frames)
    
    def save_to_file(self, filepath: str):
        """Save captured audio to WAV file."""
        audio_data = self.stop_capture()
        
        wf = wave.open(filepath, 'wb')
        wf.setnchannels(self.channels)
        wf.setsampwidth(self.audio.get_sample_size(pyaudio.paInt16))
        wf.setframerate(self.sample_rate)
        wf.writeframes(audio_data)
        wf.close()
    
    def __del__(self):
        """Cleanup."""
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
        self.audio.terminate()
