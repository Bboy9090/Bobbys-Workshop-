"""
Audit Event Types - Canonical Definitions
==========================================
All audit events use these structures.
"""

from dataclasses import dataclass
import time
from typing import Optional

@dataclass
class AuditEvent:
    """Canonical audit event - immutable after creation"""
    actor: str                 # license subject or "system"
    action: str                # e.g. "run.clonezilla", "license.verify"
    feature: str               # feature name
    result: str                # success | denied | error
    ts: Optional[int] = None   # unix timestamp (auto-set if None)
    reason: Optional[str] = None
    prev_hash: Optional[str] = None  # hash of previous event (chain)
    hash: Optional[str] = None        # hash of this event
    
    def __post_init__(self):
        """Auto-set timestamp if not provided"""
        if self.ts is None:
            self.ts = int(time.time())
