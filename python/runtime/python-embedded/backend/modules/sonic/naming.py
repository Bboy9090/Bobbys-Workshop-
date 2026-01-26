"""
Human-Readable Naming
Generates descriptive filenames for jobs.
"""

from datetime import datetime
from typing import Optional


def generate_job_filename(
    device: Optional[str] = None,
    title: Optional[str] = None,
    timestamp: Optional[datetime] = None
) -> str:
    """Generate human-readable filename for job."""
    if timestamp is None:
        timestamp = datetime.now()
    
    # Format: DeviceName_YYYY-MM-DD_HHMM_Title
    date_str = timestamp.strftime("%Y-%m-%d")
    time_str = timestamp.strftime("%H%M")
    
    parts = []
    
    if device:
        # Clean device name (remove special chars)
        clean_device = device.replace(" ", "_").replace("/", "-")
        parts.append(clean_device)
    
    parts.append(date_str)
    parts.append(time_str)
    
    if title:
        # Clean title (remove special chars, limit length)
        clean_title = title.replace(" ", "_").replace("/", "-")[:50]
        parts.append(clean_title)
    
    return "_".join(parts)


def generate_forensic_package_name(base_name: str) -> str:
    """Generate forensic package filename."""
    return f"{base_name}_FORENSIC_PACKAGE.zip"


def generate_enhanced_filename(base_name: str) -> str:
    """Generate enhanced audio filename."""
    return f"{base_name}_ENHANCED.wav"
