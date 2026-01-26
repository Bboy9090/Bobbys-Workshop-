"""
Audio Extractor
Extracts audio from video files using FFmpeg or yt-dlp for URLs.
"""

import subprocess
import os
from typing import Optional
import tempfile


def extract_audio_from_video(video_path: str, output_path: str) -> bool:
    """Extract audio from video file using FFmpeg."""
    try:
        # Use FFmpeg to extract audio
        cmd = [
            "ffmpeg",
            "-i", video_path,
            "-vn",  # No video
            "-acodec", "pcm_s16le",  # PCM 16-bit
            "-ar", "44100",  # Sample rate
            "-ac", "1",  # Mono
            "-y",  # Overwrite
            output_path
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True
        )
        
        return os.path.exists(output_path)
    except subprocess.CalledProcessError as e:
        print(f"FFmpeg error: {e.stderr}")
        return False
    except FileNotFoundError:
        print("FFmpeg not found. Please install FFmpeg.")
        return False


def extract_audio_from_url(url: str, output_path: str, format: str = "bestaudio") -> bool:
    """Extract audio from URL using yt-dlp."""
    try:
        # Try yt-dlp first
        cmd = [
            "yt-dlp",
            "-x",  # Extract audio
            "--audio-format", "wav",
            "--audio-quality", "0",  # Best quality
            "-o", output_path,
            url
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True
        )
        
        return os.path.exists(output_path)
    except FileNotFoundError:
        # Fallback: try youtube-dl
        try:
            cmd = [
                "youtube-dl",
                "-x",
                "--audio-format", "wav",
                "-o", output_path,
                url
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True
            )
            
            return os.path.exists(output_path)
        except FileNotFoundError:
            print("yt-dlp or youtube-dl not found. Please install yt-dlp.")
            return False
    except subprocess.CalledProcessError as e:
        print(f"yt-dlp error: {e.stderr}")
        return False
