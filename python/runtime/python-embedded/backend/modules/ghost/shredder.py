"""
Metadata Shredder
Removes metadata from files using FFmpeg, PIL, etc.
"""

import os
import subprocess
from PIL import Image
from PIL.ExifTags import TAGS
import json


def shred_metadata(input_path: str, output_path: str, preserve_structure: bool = True) -> bool:
    """Remove metadata from file."""
    ext = input_path.split('.')[-1].lower()
    
    try:
        if ext in ['jpg', 'jpeg', 'png', 'tiff', 'webp']:
            return shred_image_metadata(input_path, output_path)
        elif ext in ['mp4', 'avi', 'mov', 'mkv']:
            return shred_video_metadata(input_path, output_path)
        elif ext in ['mp3', 'wav', 'flac', 'm4a']:
            return shred_audio_metadata(input_path, output_path)
        elif ext in ['pdf']:
            return shred_pdf_metadata(input_path, output_path)
        else:
            # Generic copy (no metadata removal for unknown types)
            import shutil
            shutil.copy2(input_path, output_path)
            return True
    except Exception as e:
        print(f"Metadata shredding error: {e}")
        return False


def shred_image_metadata(input_path: str, output_path: str) -> bool:
    """Remove EXIF and other metadata from image."""
    try:
        img = Image.open(input_path)
        
        # Remove EXIF data
        data = list(img.getdata())
        image_without_exif = Image.new(img.mode, img.size)
        image_without_exif.putdata(data)
        
        # Save without metadata
        image_without_exif.save(output_path, quality=95)
        return True
    except Exception as e:
        print(f"Image metadata shredding error: {e}")
        return False


def shred_video_metadata(input_path: str, output_path: str) -> bool:
    """Remove metadata from video using FFmpeg."""
    try:
        cmd = [
            "ffmpeg",
            "-i", input_path,
            "-map_metadata", "-1",  # Remove all metadata
            "-c:v", "copy",  # Copy video stream
            "-c:a", "copy",  # Copy audio stream
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
        print(f"Video metadata shredding error: {e.stderr}")
        return False
    except FileNotFoundError:
        print("FFmpeg not found")
        return False


def shred_audio_metadata(input_path: str, output_path: str) -> bool:
    """Remove metadata from audio using FFmpeg."""
    try:
        cmd = [
            "ffmpeg",
            "-i", input_path,
            "-map_metadata", "-1",  # Remove all metadata
            "-c:a", "copy",  # Copy audio stream
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
        print(f"Audio metadata shredding error: {e.stderr}")
        return False
    except FileNotFoundError:
        print("FFmpeg not found")
        return False


def shred_pdf_metadata(input_path: str, output_path: str) -> bool:
    """Remove metadata from PDF."""
    # Placeholder - would use PyPDF2 or similar
    # For now, just copy
    import shutil
    shutil.copy2(input_path, output_path)
    return True
