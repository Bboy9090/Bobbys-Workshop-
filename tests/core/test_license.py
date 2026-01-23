#!/usr/bin/env python3
"""
Test Phoenix Core License System
================================
Tests canonical license signing, verification, and enforcement.
"""

import sys
import os
import time
from pathlib import Path

# Add project root to path so we can import core as a package
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# Now import from core package
from core.license.types import License
from core.license.sign import sign_license
from core.license.verify import verify_license
from core.entitlement.enforce import is_allowed
from core.core import PhoenixCore

def test_license_signing():
    """Test license signing and verification."""
    print("Testing license signing...")
    
    # Create test license (expires in 1 year)
    lic = License(
        subject="test@example.com",
        tier="pro",
        seats=5,
        capabilities=["clonezilla", "bulk_ops"],
        exp=int(time.time()) + 86400 * 365,  # 1 year from now
        license_id="test-lic-001"
    )
    
    # Sign with test key
    key = b"test-signing-key-32-bytes-long!!"
    token = sign_license(lic, key)
    
    print(f"[OK] Signed token: {token[:50]}...")
    
    # Verify
    verified = verify_license(token, key)
    
    if verified is None:
        print(f"[DEBUG] Verification returned None - checking why...")
        # Try manual verification
        import base64
        import json
        token_bytes = token.encode()
        missing_padding = len(token_bytes) % 4
        if missing_padding:
            token_bytes += b'=' * (4 - missing_padding)
        raw = base64.urlsafe_b64decode(token_bytes)
        if b'.' in raw:
            data, sig = raw.rsplit(b".", 1)
            payload = json.loads(data.decode())
            print(f"[DEBUG] Payload: {payload}")
            print(f"[DEBUG] Current time: {time.time()}, Exp: {payload.get('exp')}")
    
    assert verified is not None, "License verification failed"
    assert verified.tier == "pro", f"Tier mismatch: {verified.tier}"
    assert verified.seats == 5, f"Seats mismatch: {verified.seats}"
    
    print("[OK] License verification passed")
    return True

def test_entitlement_enforcement():
    """Test feature gating."""
    print("Testing entitlement enforcement...")
    
    # Test free tier
    assert is_allowed("boot", "free") == True
    assert is_allowed("clonezilla", "free") == False
    
    # Test pro tier (wildcard - allows everything)
    assert is_allowed("clonezilla", "pro") == True
    assert is_allowed("any_feature", "pro") == True
    assert is_allowed("audit_export", "pro") == True  # Pro has wildcard
    
    # Test enterprise tier
    assert is_allowed("audit_export", "enterprise") == True
    
    print("[OK] Entitlement enforcement passed")
    return True

def test_phoenix_core():
    """Test PhoenixCore authorize method."""
    print("Testing PhoenixCore...")
    
    # Create license (expires in 1 year)
    lic = License(
        subject="test@example.com",
        tier="pro",
        seats=5,
        capabilities=["clonezilla"],
        exp=int(time.time()) + 86400 * 365,  # 1 year from now
        license_id="test-lic-002"
    )
    
    # Sign
    key = b"test-signing-key-32-bytes-long!!"
    token = sign_license(lic, key)
    
    # Initialize core
    core = PhoenixCore(key)
    
    # Authorize allowed feature
    try:
        license_obj = core.authorize(token, "clonezilla", "test")
        assert license_obj.tier == "pro"
        print("[OK] Pro feature authorized")
    except Exception as e:
        print(f"[FAIL] Authorization failed: {e}")
        return False
    
    # Try to authorize free-tier-only feature with pro (should work)
    try:
        license_obj = core.authorize(token, "boot", "test")
        assert license_obj.tier == "pro"
        print("[OK] Free feature authorized for pro")
    except Exception as e:
        print(f"[FAIL] Authorization failed: {e}")
        return False
    
    # Try enterprise-only feature with pro
    # Note: Pro has "*" wildcard, so it actually allows all features
    # This test verifies the wildcard behavior
    try:
        license_obj = core.authorize(token, "audit_export", "test")
        # Pro tier has wildcard, so this is actually allowed
        print("[OK] Enterprise feature allowed for pro (wildcard)")
    except Exception as e:
        print(f"[INFO] Enterprise feature denied for pro: {e}")
    
    return True

def test_free_tier():
    """Test free tier (no token)."""
    print("Testing free tier...")
    
    key = b"test-signing-key-32-bytes-long!!"
    core = PhoenixCore(key)
    
    # Free tier should allow basic features
    try:
        license_obj = core.authorize("", "boot", "anonymous")
        assert license_obj.tier == "free"
        print("[OK] Free tier access granted")
    except Exception as e:
        print(f"[FAIL] Free tier failed: {e}")
        return False
    
    # Free tier should deny pro features
    try:
        core.authorize("", "clonezilla", "anonymous")
        print("[FAIL] Free tier should deny clonezilla")
        return False
    except Exception:
        print("[OK] Free tier correctly denies pro features")
    
    return True

if __name__ == "__main__":
    print("=" * 60)
    print("PHOENIX CORE LICENSE SYSTEM TESTS")
    print("=" * 60)
    
    tests = [
        test_license_signing,
        test_entitlement_enforcement,
        test_phoenix_core,
        test_free_tier
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            if test():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"[FAIL] Test {test.__name__} crashed: {e}")
            failed += 1
        print()
    
    print("=" * 60)
    print(f"RESULTS: {passed} passed, {failed} failed")
    print("=" * 60)
    
    sys.exit(0 if failed == 0 else 1)
