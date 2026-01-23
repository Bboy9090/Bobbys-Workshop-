"""
Audit Core - Tamper-Evident Logging
====================================
All audit logging happens here. Append-only, hash-chained.
"""

from .log import append, hash_event
from .seal import seal
from .types import AuditEvent

__all__ = [
    "append",
    "hash_event",
    "seal",
    "AuditEvent"
]
