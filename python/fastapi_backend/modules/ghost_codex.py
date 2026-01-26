"""
Ghost Codex Module
Metadata shredding, canary tokens, burner personas
"""

import json
import uuid
import random
import string
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, List
import shutil

try:
    from PIL import Image
    from PIL.ExifTags import TAGS
    PILOW_AVAILABLE = True
except ImportError:
    PILOW_AVAILABLE = False

try:
    import exifread
    EXIFREAD_AVAILABLE = True
except ImportError:
    EXIFREAD_AVAILABLE = False


def generate_canary_token(token_type: str, name: Optional[str] = None) -> Dict:
    """Generate a canary token (trap file)"""
    token_id = f"canary-{uuid.uuid4().hex[:12]}"
    
    metadata = {}
    if token_type == "file":
        # Generate HTML beacon file
        metadata = {
            "filename": f"{token_id}.html",
            "content": f"""<!DOCTYPE html>
<html>
<head>
    <title>Confidential Document</title>
</head>
<body>
    <h1>Confidential Document</h1>
    <p>This document contains sensitive information.</p>
    <img src="http://canary.example.com/beacon?token={token_id}" style="display:none;" />
</body>
</html>""",
            "mime_type": "text/html"
        }
    elif token_type == "email":
        metadata = {
            "email": f"{token_id}@canary.example.com"
        }
    elif token_type == "url":
        metadata = {
            "url": f"https://canary.example.com/{token_id}"
        }
    elif token_type == "webhook":
        metadata = {
            "webhook_url": f"https://canary.example.com/webhook/{token_id}"
        }
    
    token_data = {
        "tokenId": token_id,
        "tokenType": token_type,
        "name": name or f"Canary Token {token_id[:8]}",
        "createdAt": datetime.now().isoformat(),
        "triggered": False,
        "triggeredAt": None,
        "metadata": metadata
    }
    
    return token_data


def create_persona(persona_type: str, name: Optional[str] = None) -> Dict:
    """Create a burner persona (temporary identity)"""
    persona_id = f"persona-{uuid.uuid4().hex[:12]}"
    
    # Generate random identity data
    first_names = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Sam", "Jamie"]
    last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis"]
    
    if not name:
        name = f"{random.choice(first_names)} {random.choice(last_names)}"
    
    # Generate email
    email_username = name.lower().replace(" ", ".") + str(random.randint(100, 999))
    email = f"{email_username}@burner.example.com"
    
    # Generate phone (US format)
    phone = f"+1{random.randint(200, 999)}{random.randint(200, 999)}{random.randint(1000, 9999)}"
    
    persona = {
        "personaId": persona_id,
        "personaType": persona_type,
        "name": name,
        "email": email,
        "phone": phone,
        "createdAt": datetime.now().isoformat(),
        "metadata": {
            "location": "Generated",
            "notes": f"Burner persona for {persona_type} use"
        }
    }
    
    # Add professional persona fields if needed
    if persona_type == "professional":
        persona["metadata"]["title"] = random.choice(["Consultant", "Analyst", "Manager", "Director"])
        persona["metadata"]["company"] = random.choice(["Acme Corp", "Global Solutions", "Tech Industries"])
    
    return persona


def shred_metadata(file_path: Path, output_path: Optional[Path] = None) -> Dict:
    """Remove metadata from a file"""
    if not PILOW_AVAILABLE:
        raise ImportError("Pillow is required for metadata shredding. Install with: pip install Pillow")
    
    output_path = output_path or file_path.with_name(f"{file_path.stem}_cleaned{file_path.suffix}")
    
    # Get file extension
    ext = file_path.suffix.lower()
    
    metadata_removed = []
    
    if ext in ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.webp']:
        # Image metadata removal
        try:
            img = Image.open(file_path)
            
            # Remove EXIF data
            if hasattr(img, '_getexif') and img._getexif() is not None:
                metadata_removed.append("EXIF")
            
            # Create new image without metadata
            data = list(img.getdata())
            image_without_exif = Image.new(img.mode, img.size)
            image_without_exif.putdata(data)
            image_without_exif.save(output_path, format=img.format)
            
            metadata_removed.append(f"{ext[1:].upper()} metadata")
        except Exception as e:
            raise Exception(f"Failed to remove image metadata: {str(e)}")
    else:
        # For other file types, copy file (can't remove metadata without specialized tools)
        shutil.copy2(file_path, output_path)
        metadata_removed.append("File copied (metadata removal not supported for this file type)")
    
    return {
        "success": True,
        "original_file": str(file_path),
        "cleaned_file": str(output_path),
        "metadata_removed": metadata_removed,
        "message": f"Metadata removed from {file_path.name}"
    }


def extract_metadata(file_path: Path) -> Dict:
    """Extract metadata from a file"""
    metadata = {
        "filename": file_path.name,
        "file_size": file_path.stat().st_size,
        "created_at": datetime.fromtimestamp(file_path.stat().st_ctime).isoformat(),
        "modified_at": datetime.fromtimestamp(file_path.stat().st_mtime).isoformat(),
        "exif_data": {}
    }
    
    ext = file_path.suffix.lower()
    
    if ext in ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.webp']:
        if PILOW_AVAILABLE:
            try:
                img = Image.open(file_path)
                if hasattr(img, '_getexif') and img._getexif() is not None:
                    exif_dict = {TAGS[k]: v for k, v in img._getexif().items() if k in TAGS}
                    metadata["exif_data"] = exif_dict
            except Exception:
                pass  # No EXIF data or error reading
        
        if EXIFREAD_AVAILABLE:
            try:
                with open(file_path, 'rb') as f:
                    tags = exifread.process_file(f)
                    metadata["exifread_data"] = {str(k): str(v) for k, v in tags.items()}
            except Exception:
                pass  # Error reading EXIF
    
    return metadata
