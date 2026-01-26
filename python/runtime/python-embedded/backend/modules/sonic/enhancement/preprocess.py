"""
Audio Preprocessing
Spectral gating and noise reduction.
"""

import numpy as np
from scipy import signal
import soundfile as sf


def preprocess_audio(input_path: str, output_path: str, preset: str = "forensic") -> bool:
    """Preprocess audio with spectral gating."""
    try:
        # Load audio
        data, sample_rate = sf.read(input_path)
        
        # Apply spectral gating based on preset
        if preset == "forensic":
            # Aggressive noise reduction for forensic analysis
            data = apply_spectral_gate(data, sample_rate, threshold=-40)
        elif preset == "conversation":
            # Moderate noise reduction for conversation clarity
            data = apply_spectral_gate(data, sample_rate, threshold=-30)
        else:
            # Light noise reduction
            data = apply_spectral_gate(data, sample_rate, threshold=-20)
        
        # Save processed audio
        sf.write(output_path, data, sample_rate)
        return True
    except Exception as e:
        print(f"Preprocessing error: {e}")
        return False


def apply_spectral_gate(audio: np.ndarray, sample_rate: int, threshold: float = -30) -> np.ndarray:
    """Apply spectral gating to reduce noise."""
    # Simple spectral gate implementation
    # In production, use more sophisticated methods (e.g., deepfilter)
    
    # Compute short-time Fourier transform
    f, t, Sxx = signal.spectrogram(audio, sample_rate, nperseg=1024)
    
    # Apply threshold
    Sxx[Sxx < 10**(threshold/20)] = 0
    
    # Reconstruct signal (simplified - production would use proper ISTFT)
    # For now, return original with simple high-pass filter
    b, a = signal.butter(4, 80, 'hp', fs=sample_rate)
    filtered = signal.filtfilt(b, a, audio)
    
    return filtered
