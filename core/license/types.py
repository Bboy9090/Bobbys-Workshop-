"""
License Type Definitions
========================
Canonical data structures for license objects.
"""

from dataclasses import dataclass
from typing import List, Optional

@dataclass
class License:
    """Canonical license object - immutable after creation"""
    subject: str            # email or org identifier
    tier: str               # free | pro | enterprise
    seats: int              # number of concurrent seats
    capabilities: List[str] # feature list
    exp: Optional[int]      # unix timestamp expiry
    org_id: Optional[str] = None  # organization ID (enterprise)
    issuer_id: Optional[str] = None  # which issuer key signed this
    env: Optional[str] = None  # PROD | STAGING | AIRGAP
    license_id: Optional[str] = None  # unique license identifier
