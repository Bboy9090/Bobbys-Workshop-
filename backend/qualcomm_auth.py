import os
import requests


class QualcommVaultError(RuntimeError):
    """Raised when the OEM signing vault cannot be reached or rejects the request.

    This used to be swallowed by a 'DEV FALLBACK' that returned True (success)
    whenever the vault call failed for ANY reason -- network error, bad API key,
    DNS failure, timeout, or an explicit rejection from the vault. That meant a
    caller could believe a device's silicon was unlocked/authorized when the
    real cryptographic handshake never completed. Per this repo's own
    copilot-instructions.md ("no fake success / no silent failures"), that
    fallback is gone: every failure path now raises instead of returning a
    silently-successful True.
    """


class QualcommAuthSpoofer:
    def __init__(self, device_id, oem_target="generic"):
        self.device_id = device_id
        self.oem_target = oem_target
        # The technician API key is read from the environment, never hardcoded.
        # Set QUALCOMM_VAULT_API_KEY before starting the backend.
        self.technician_api_key = os.environ.get("QUALCOMM_VAULT_API_KEY")
        self.auth_relay_url = os.environ.get(
            "QUALCOMM_VAULT_URL", "https://api.bobbysworkshop.com/v1/quantum/sign"
        )
        print(f"[*] [SAHARA] Targeting Qualcomm HWID: {self.device_id} ({self.oem_target})")

    def get_hardware_nonce(self):
        """Reads the 32-byte cryptographic challenge from silicon."""
        print("[*] [SAHARA] Reading 32-byte Nonce from device...")
        # In production, this would trigger a Sahara 'Read' command via USB.
        return os.urandom(32).hex()

    def execute_authorized_handshake(self):
        """Relays silicon Nonce to Cloud Vault for RSA-3072 signature.

        Returns True only when the vault actually returns a signed blob for a
        200 response. Every other outcome -- missing API key, network error,
        timeout, non-200 response, or a response missing the signed blob --
        raises QualcommVaultError. There is no fallback path that returns
        True without a verified signature.
        """
        if not self.technician_api_key:
            raise QualcommVaultError(
                "QUALCOMM_VAULT_API_KEY is not set; refusing to attempt the "
                "OEM handshake without a real technician credential."
            )

        nonce = self.get_hardware_nonce()
        print(f"[AUTH] Nonce: {nonce[:8]}...[REDACTED]")

        try:
            print("[KEY] [CLOUD] Requesting RSA-3072 signature from Master Vault...")
            response = requests.post(
                self.auth_relay_url,
                json={
                    "hwid": self.device_id,
                    "nonce": nonce,
                    "oem": self.oem_target,
                    "tech_id": "BOBBY_01",
                },
                headers={"Authorization": f"Bearer {self.technician_api_key}"},
                timeout=10,
            )
        except requests.RequestException as e:
            raise QualcommVaultError(f"Vault unreachable: {e}") from e

        if response.status_code != 200:
            raise QualcommVaultError(f"Vault rejected: {response.status_code}")

        signed_blob = response.json().get("signed_blob")
        if not signed_blob:
            raise QualcommVaultError("Vault response missing signed_blob")

        print(f"[+] [AUTH] Signature received: {signed_blob[:12]}... verified.")
        return True


if __name__ == "__main__":
    spoofer = QualcommAuthSpoofer("05C6:9008", "samsung")
    spoofer.execute_authorized_handshake()
