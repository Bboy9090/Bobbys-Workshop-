"""
Audit Sealing - Tamper Evidence
================================
Creates cryptographic seals of audit logs.
"""

import hashlib
import json
import time
from pathlib import Path

def seal(path: str, output_path: str = None) -> str:
    """
    Create a cryptographic seal of an audit log.
    
    Args:
        path: Path to audit log file
        output_path: Where to write seal file (auto if None)
    
    Returns:
        Seal hash (hex)
    """
    h = hashlib.sha256()
    
    if not Path(path).exists():
        return ""
    
    with open(path, "rb") as f:
        for line in f:
            h.update(line)
    
    seal_hash = h.hexdigest()
    
    # Write seal file
    if output_path is None:
        output_path = f"{path}.seal"
    
    seal_data = {
        "log_path": path,
        "seal_hash": seal_hash,
        "sealed_at": int(time.time()),
        "algorithm": "SHA-256"
    }
    
    with open(output_path, "w") as f:
        json.dump(seal_data, f, indent=2)
    
    return seal_hash
