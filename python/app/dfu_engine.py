"""
DFU Engine (transport-layer)

Safe, low-level DFU communication helpers for Apple devices in DFU mode.

This module is intended for **device mode detection and DFU protocol hygiene**
(status/state queries + reliable transfer primitives).
It is not an exploit chain and does not implement bypass logic.
"""

from __future__ import annotations

import os
import time
import logging
from dataclasses import dataclass
from typing import Callable, Optional, Tuple

import usb.core
import usb.util
import usb.backend.libusb1

logger = logging.getLogger("DFUEngine")


# DFU class requests (USB DFU 1.1)
DFU_DNLOAD = 1
DFU_UPLOAD = 2
DFU_GETSTATUS = 3
DFU_CLRSTATUS = 4
DFU_GETSTATE = 5
DFU_ABORT = 6


@dataclass(frozen=True)
class DFUStatus:
    status: int
    poll_timeout_ms: int
    state: int
    i_string: int


def _default_libusb_backend():
    """
    Best-effort libusb backend selection.

    On Windows, PyUSB often requires libusb-1.0 to be installed and discoverable.
    If you need to point to a specific DLL, set:
      PYUSB_LIBUSB1_PATH=C:\\path\\to\\libusb-1.0.dll
    """

    libusb_path = os.environ.get("PYUSB_LIBUSB1_PATH")
    if libusb_path:
        return usb.backend.libusb1.get_backend(find_library=lambda _: libusb_path)
    return usb.backend.libusb1.get_backend()


class AppleDFUDevice:
    """
    Minimal DFU transport helper for Apple DFU devices (VID 0x05AC, PID 0x1227).

    - Acquire device handle
    - (Optionally) claim DFU interface
    - Query DFU status/state
    - Transfer bytes using DFU_DNLOAD

    NOTE: DFU mode entry/exit requires physical user interaction.
    """

    VENDOR_APPLE = 0x05AC
    PRODUCT_DFU = 0x1227

    # Common DFU interface characteristics
    DEFAULT_INTERFACE = 0
    DEFAULT_ALT_SETTING = 0

    # Conservative packet sizing; DFU block size is device-specific.
    MAX_PACKET_SIZE = 0x800

    def __init__(
        self,
        timeout: float = 5.0,
        serial_match: Optional[str] = None,
        *,
        backend=None,
        interface: int = DEFAULT_INTERFACE,
        alt_setting: int = DEFAULT_ALT_SETTING,
        detach_kernel_driver: bool = True,
    ):
        self.timeout = float(timeout)
        self.serial_match = serial_match
        self.backend = backend or _default_libusb_backend()
        self.interface = interface
        self.alt_setting = alt_setting
        self.detach_kernel_driver = detach_kernel_driver

        self.device: Optional[usb.core.Device] = None
        self._claimed = False

    # ----------------------------
    # Acquisition / lifecycle
    # ----------------------------

    def acquire(self) -> bool:
        """
        Hunt for an Apple DFU device until timeout. Returns True if acquired.
        """
        start_time = time.time()
        logger.info("Searching for Apple DFU device (VID=0x%04X PID=0x%04X)...", self.VENDOR_APPLE, self.PRODUCT_DFU)

        while (time.time() - start_time) < self.timeout:
            devices = usb.core.find(
                find_all=True,
                idVendor=self.VENDOR_APPLE,
                idProduct=self.PRODUCT_DFU,
                backend=self.backend,
            )

            for dev in devices:
                if self.serial_match:
                    sn = self.try_get_serial(dev)
                    if not sn:
                        continue
                    if self.serial_match not in sn:
                        continue

                self.device = dev
                logger.info("Device acquired%s", f": SN={self.try_get_serial(dev) or 'unknown'}")

                # Prepare device for transfers
                self._prepare_device()
                return True

            time.sleep(0.1)

        logger.error("Timeout: No Apple DFU device detected after %.2fs", self.timeout)
        return False

    def release(self) -> None:
        if not self.device:
            return

        try:
            if self._claimed:
                try:
                    usb.util.release_interface(self.device, self.interface)
                except Exception:
                    pass
                self._claimed = False
        finally:
            try:
                usb.util.dispose_resources(self.device)
            finally:
                self.device = None
                logger.info("Device handle released")

    def __enter__(self) -> "AppleDFUDevice":
        if not self.acquire():
            raise RuntimeError("No Apple DFU device found")
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.release()

    # ----------------------------
    # DFU protocol helpers
    # ----------------------------

    def dfu_clrstatus(self) -> None:
        self._require_device()
        # bmRequestType: 0x21 (Host->Device, Class, Interface)
        # bRequest: DFU_CLRSTATUS
        self.device.ctrl_transfer(0x21, DFU_CLRSTATUS, 0, self.interface, None, 1000)

    def dfu_abort(self) -> None:
        self._require_device()
        self.device.ctrl_transfer(0x21, DFU_ABORT, 0, self.interface, None, 1000)

    def dfu_getstatus(self) -> DFUStatus:
        self._require_device()
        # bmRequestType: 0xA1 (Device->Host, Class, Interface)
        # bRequest: DFU_GETSTATUS
        data = self.device.ctrl_transfer(0xA1, DFU_GETSTATUS, 0, self.interface, 6, 1000)
        if len(data) != 6:
            raise RuntimeError(f"DFU_GETSTATUS returned {len(data)} bytes (expected 6)")

        status = int(data[0])
        poll_timeout_ms = int(data[1]) | (int(data[2]) << 8) | (int(data[3]) << 16)
        state = int(data[4])
        i_string = int(data[5])
        return DFUStatus(status=status, poll_timeout_ms=poll_timeout_ms, state=state, i_string=i_string)

    def dfu_getstate(self) -> int:
        self._require_device()
        data = self.device.ctrl_transfer(0xA1, DFU_GETSTATE, 0, self.interface, 1, 1000)
        if len(data) != 1:
            raise RuntimeError(f"DFU_GETSTATE returned {len(data)} bytes (expected 1)")
        return int(data[0])

    # ----------------------------
    # Transfer primitives
    # ----------------------------

    def dnload(self, data: bytes, *, block: int = 0, timeout_ms: int = 5000) -> int:
        """
        DFU_DNLOAD a single block. Returns bytes written.
        """
        self._require_device()
        if not isinstance(data, (bytes, bytearray)):
            raise TypeError("dnload expects bytes")
        return int(self.device.ctrl_transfer(0x21, DFU_DNLOAD, block, self.interface, data, timeout_ms))

    def download(
        self,
        data: bytes,
        *,
        block_size: int = MAX_PACKET_SIZE,
        start_block: int = 0,
        per_block_timeout_ms: int = 5000,
        on_progress: Optional[Callable[[int, int], None]] = None,
    ) -> None:
        """
        Download a byte buffer via sequential DFU_DNLOAD blocks.

        This is transport-only: it does not interpret the data.
        """
        self._require_device()
        if block_size <= 0:
            raise ValueError("block_size must be > 0")

        total = len(data)
        logger.info("DFU download start: %d bytes (block_size=%d)", total, block_size)

        offset = 0
        block = int(start_block)
        while offset < total:
            chunk = data[offset : offset + block_size]
            written = self.dnload(chunk, block=block, timeout_ms=per_block_timeout_ms)
            if written != len(chunk):
                raise RuntimeError(f"Short write: wrote {written} bytes, expected {len(chunk)} (block={block})")
            offset += len(chunk)
            block += 1

            if on_progress:
                on_progress(offset, total)

        logger.info("DFU download complete: %d bytes", total)

    def finalize_download(self, *, reset_usb: bool = True) -> DFUStatus:
        """
        Signal end-of-download (zero-length DNLOAD) and poll DFU status.

        This follows standard DFU behavior (dfuMANIFEST / WAIT_RESET) but
        intentionally does not assume any specific payload semantics.
        """
        self._require_device()
        logger.info("Finalizing DFU download (zero-length DNLOAD)")
        self.device.ctrl_transfer(0x21, DFU_DNLOAD, 0, self.interface, b"", 1000)

        # Poll a few times; some devices report poll timeout.
        last = None
        for _ in range(10):
            st = self.dfu_getstatus()
            last = st
            if st.poll_timeout_ms:
                time.sleep(st.poll_timeout_ms / 1000.0)
            else:
                time.sleep(0.05)

        if reset_usb:
            try:
                self.device.reset()
                logger.info("USB reset requested")
            except usb.core.USBError:
                logger.warning("USB reset raised USBError (device may have re-enumerated)")

        return last or self.dfu_getstatus()

    # ----------------------------
    # Internals
    # ----------------------------

    def _require_device(self) -> None:
        if not self.device:
            raise RuntimeError("Device not acquired")

    def _prepare_device(self) -> None:
        self._require_device()
        dev = self.device

        # Attempt to set a configuration (some DFU implementations require this for interface claims)
        try:
            dev.set_configuration()
        except usb.core.USBError:
            # Many DFU devices are fine without explicit set_configuration
            pass

        if self.detach_kernel_driver:
            try:
                if dev.is_kernel_driver_active(self.interface):
                    dev.detach_kernel_driver(self.interface)
            except (NotImplementedError, usb.core.USBError):
                pass

        # Claim interface (best-effort; some devices/OSes may not allow it without privileges)
        try:
            usb.util.claim_interface(dev, self.interface)
            self._claimed = True
        except usb.core.USBError:
            self._claimed = False

        # Try selecting alt setting
        try:
            dev.set_interface_altsetting(interface=self.interface, alternate_setting=self.alt_setting)
        except usb.core.USBError:
            pass

    @staticmethod
    def try_get_serial(dev: usb.core.Device) -> Optional[str]:
        try:
            return dev.serial_number
        except Exception:
            return None

