"""
Policy mode enforcement (mirror-only, never escalation).
"""

from enum import Enum


class PolicyMode(Enum):
    """Policy mode enumeration."""
    PUBLIC = "public"
    # Add other modes as needed
    
    def allows_inspect(self) -> bool:
        """Check if inspect operations are allowed."""
        return True  # Public mode allows inspection
    
    def allows_mutation(self) -> bool:
        """Check if device mutation is allowed."""
        return False  # Never allow mutation from Python
    
    def allows_deep_probe(self) -> bool:
        """Check if deep inspection is allowed."""
        return self == PolicyMode.PUBLIC  # Only in public mode for now
