"""
Audit Logging - Append-Only, Hash-Chained
==========================================
Tamper-evident logging with hash chaining.
"""

import json
import hashlib
import os
from pathlib import Path
from .types import AuditEvent

DEFAULT_AUDIT_PATH = "/var/log/phoenix-audit.log"

def hash_event(event_dict: dict) -> str:
    """
    Compute SHA-256 hash of event (for chaining).
    
    Args:
        event_dict: Event as dictionary
    
    Returns:
        Hex-encoded hash
    """
    h = hashlib.sha256()
    # Sort keys for deterministic hashing
    h.update(json.dumps(event_dict, sort_keys=True).encode())
    return h.hexdigest()

def append(event: AuditEvent, path: str = None) -> bool:
    """
    Append audit event to log file (hash-chained).
    
    Args:
        event: AuditEvent object
        path: Log file path (uses default if None)
    
    Returns:
        True if successful
    """
    if path is None:
        path = DEFAULT_AUDIT_PATH
    
    # Ensure directory exists
    log_dir = Path(path).parent
    log_dir.mkdir(parents=True, exist_ok=True)
    
    # Load previous hash (if log exists)
    prev_hash = None
    if os.path.exists(path):
        try:
            with open(path, "rb") as f:
                lines = f.readlines()
                if lines:
                    last = json.loads(lines[-1].decode())
                    prev_hash = last.get("hash")
        except Exception:
            pass
    
    # Set previous hash
    event.prev_hash = prev_hash
    
    # Compute this event's hash
    event_dict = {
        "ts": event.ts,
        "actor": event.actor,
        "action": event.action,
        "feature": event.feature,
        "result": event.result,
        "reason": event.reason,
        "prev_hash": prev_hash
    }
    event.hash = hash_event(event_dict)
    
    # Append to log
    try:
        with open(path, "a") as f:
            f.write(json.dumps(event_dict) + "\n")
        return True
    except Exception:
        return False
