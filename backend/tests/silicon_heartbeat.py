import time
import requests
import json

class SiliconHeartbeatTest:
    def __init__(self, target_node="http://localhost:8000"):
        self.api = target_node
        self.test_target = "05C6:9008" # Mocking a Qualcomm Gen 6 device
        print("\n[START] INITIATING SILICON HEARTBEAT TEST BENCH")
        print("===================================================")

    def test_pulse_detection(self):
        """Verifies the Rust FFI is communicating with the Python backend."""
        print("[*] TEST 1: Polling Hardware Listener (Rust FFI)...")
        try:
            res = requests.get(f"{self.api}/api/devices/scan")
            if res.status_code == 200 and len(res.json().get("devices", [])) > 0:
                print("    [PASS] Hardware bridge active and routing.")
                return True
            print("    [FAIL] No devices detected on bus.")
            return False
        except Exception as e:
            print(f"    [FATAL] Backend offline. {e}")
            return False

    def test_shadow_rollback(self):
        """Forces the backend to execute a cryptographic backup."""
        print("[*] TEST 2: Executing Defensive Shadow Rollback...")
        payload = {"device_id": self.test_target, "partitions": ["efs", "nvram"]}
        try:
            res = requests.post(f"{self.api}/api/security/rollback", json=payload)
            data = res.json()
            if res.status_code == 200 and data.get("status") == "secure":
                print(f"    [PASS] Vault secured. Receipts generated: {len(data.get('receipts', []))}")
                return True
            print(f"    [FAIL] Rollback rejected. {data}")
            return False
        except Exception as e:
            print(f"    [FATAL] API Error. {e}")
            return False

    def test_rsa_cloud_auth(self):
        """Simulates the Qualcomm OEM Auth Spooler."""
        print("[*] TEST 3: Verifying RSA-3072 Cloud Authentication...")
        payload = {"device_id": self.test_target, "oem_target": "generic"}
        try:
            res = requests.post(f"{self.api}/api/security/authorize", json=payload)
            if res.status_code == 200 and res.json().get("status") == "authorized":
                print("    [PASS] Cloud Signature spoofed and verified.")
                return True
            print("    [FAIL] Cloud Vault rejected handshake.")
            return False
        except Exception as e:
            print(f"    [FATAL] Auth sequence aborted. {e}")
            return False

    def execute_full_diagnostic(self):
        start_time = time.time()
        results = [
            self.test_pulse_detection(),
            self.test_shadow_rollback(),
            self.test_rsa_cloud_auth()
        ]
        
        print("\n===================================================")
        if all(results):
            print(f"[SUCCESS] HEARTBEAT STABLE: All enterprise security layers passed in {round(time.time() - start_time, 2)}s.")
        else:
            print("[CRITICAL] HEARTBEAT FAILED: One or more infrastructure checks failed.")
        print("===================================================")

if __name__ == "__main__":
    auditor = SiliconHeartbeatTest()
    auditor.execute_full_diagnostic()
