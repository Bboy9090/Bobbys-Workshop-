"""
Consonant Boost Enhancement
Enhances consonant clarity for better transcription.
"""

import numpy as np
from scipy import signal
import soundfile as sf


def apply_consonant_boost(input_path: str, output_path: str, boost_db: float = 6.0) -> bool:
    """Apply consonant boost to enhance speech clarity."""
    try:
        # Load audio
        data, sample_rate = sf.read(input_path)
        
        # Apply high-frequency boost (consonants are typically 2-8kHz)
        # Design a filter to boost 2-8kHz range
        nyquist = sample_rate / 2
        low = 2000 / nyquist
        high = 8000 / nyquist
        
        # Create bandpass filter for consonant range
        b, a = signal.butter(4, [low, high], btype='band')
        consonant_band = signal.filtfilt(b, a, data)
        
        # Boost the consonant band
        boost_factor = 10**(boost_db / 20)
        boosted = data + (consonant_band * (boost_factor - 1))
        
        # Normalize to prevent clipping
        max_val = np.max(np.abs(boosted))
        if max_val > 1.0:
            boosted = boosted / max_val
        
        # Save enhanced audio
        sf.write(output_path, boosted, sample_rate)
        return True
    except Exception as e:
        print(f"Consonant boost error: {e}")
        return False
