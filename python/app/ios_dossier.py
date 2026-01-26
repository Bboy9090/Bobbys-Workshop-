"""
🏆 iOS Device Dossier - 100% Real Implementation
Collects comprehensive iOS device information using libimobiledevice
"""

import subprocess
import json
from typing import Dict, Optional, List
from datetime import datetime
from .platform import Platform, get_platform_detector, is_tool_available

class iOSDossier:
    """iOS device information collection"""
    
    def __init__(self):
        self.platform_detector = get_platform_detector()
    
    def collect_dossier(self, udid: str) -> Dict:
        """
        Collect comprehensive iOS device dossier
        
        Args:
            udid: iOS device UDID
        
        Returns:
            Dictionary with device information
        """
        if not is_tool_available('ideviceinfo'):
            return {
                'success': False,
                'error': 'libimobiledevice not available',
                'udid': udid
            }
        
        dossier = {
            'success': True,
            'platform': 'ios',
            'udid': udid,
            'timestamp': datetime.now().isoformat(),
            'device_info': {},
            'battery': {},
            'security': {},
            'capabilities': {},
            'metadata': {}
        }
        
        try:
            # Basic device information
            dossier['device_info'] = self._get_device_info(udid)
            
            # Battery information
            dossier['battery'] = self._get_battery_info(udid)
            
            # Security information
            dossier['security'] = self._get_security_info(udid)
            
            # Capabilities
            dossier['capabilities'] = self._get_capabilities(udid)
            
            # Metadata
            dossier['metadata'] = self._get_metadata(udid)
            
        except Exception as e:
            dossier['success'] = False
            dossier['error'] = str(e)
        
        return dossier
    
    def _get_device_info(self, udid: str) -> Dict:
        """Get basic device information"""
        info = {}
        
        # Key properties to retrieve
        properties = [
            'ProductType',           # iPhone15,2, iPad13,1, etc.
            'ProductVersion',         # iOS version
            'DeviceName',            # User's device name
            'SerialNumber',          # Device serial
            'HardwareModel',         # Hardware model
            'HardwarePlatform',      # Platform (e.g., s8000)
            'CPUArchitecture',       # CPU architecture
            'UniqueDeviceID',        # UDID
            'InternationalMobileEquipmentIdentity',  # IMEI
            'BluetoothAddress',      # Bluetooth MAC
            'WiFiAddress',          # WiFi MAC
            'BasebandVersion',      # Baseband version
            'FirmwareVersion',      # Firmware version
            'ModelNumber',          # Model number
            'PartitionType',        # Partition type
        ]
        
        for prop in properties:
            try:
                result = subprocess.run(
                    ['ideviceinfo', '-u', udid, '-k', prop],
                    capture_output=True,
                    timeout=5,
                    text=True
                )
                if result.returncode == 0:
                    value = result.stdout.strip()
                    if value:
                        # Convert property name to snake_case
                        key = prop.lower().replace(' ', '_')
                        info[key] = value
            except Exception:
                pass
        
        return info
    
    def _get_battery_info(self, udid: str) -> Dict:
        """
        Get battery information
        
        Note: Battery information may not be available on all iOS devices
        without jailbreak or special entitlements
        """
        battery = {
            'available': False,
            'note': 'Battery information may be limited without jailbreak'
        }
        
        # Try to get battery info via ideviceinfo
        # Note: This may not work on all devices/versions
        try:
            result = subprocess.run(
                ['ideviceinfo', '-u', udid, '-k', 'BatteryCurrentCapacity'],
                capture_output=True,
                timeout=5,
                text=True
            )
            if result.returncode == 0:
                value = result.stdout.strip()
                if value:
                    battery['available'] = True
                    battery['current_capacity'] = value
            
            result = subprocess.run(
                ['ideviceinfo', '-u', udid, '-k', 'BatteryIsCharging'],
                capture_output=True,
                timeout=5,
                text=True
            )
            if result.returncode == 0:
                value = result.stdout.strip()
                if value:
                    battery['is_charging'] = value == 'true'
            
        except Exception:
            pass
        
        return battery
    
    def _get_security_info(self, udid: str) -> Dict:
        """Get security/activation information"""
        security = {}
        
        # Security-related properties
        properties = [
            'ActivationState',       # Activated, Unactivated, etc.
            'ActivationStateAcknowledged',
            'BasebandActivationTicketVersion',
            'BasebandCertId',
            'BasebandKeyHashInformation',
            'BasebandMasterKeyHash',
            'BasebandSerialNumber',
            'BasebandStatus',
            'BasebandVersion',
            'BluetoothAddress',
            'DeviceCertificate',
            'DevicePublicKey',
            'EthernetAddress',
            'HardwareEncryptionCaps',
            'IntegratedCircuitCardIdentity',  # ICCID
            'InternationalMobileEquipmentIdentity',  # IMEI
            'InternationalMobileSubscriberIdentity',  # IMSI
            'MLBSerialNumber',
            'MobileSubscriberCountryCode',
            'MobileSubscriberNetworkCode',
            'ProductType',
            'SerialNumber',
            'UniqueDeviceID',
            'WiFiAddress',
        ]
        
        for prop in properties:
            try:
                result = subprocess.run(
                    ['ideviceinfo', '-u', udid, '-k', prop],
                    capture_output=True,
                    timeout=5,
                    text=True
                )
                if result.returncode == 0:
                    value = result.stdout.strip()
                    if value:
                        # Convert property name to snake_case
                        key = prop.lower().replace(' ', '_')
                        security[key] = value
            except Exception:
                pass
        
        return security
    
    def _get_capabilities(self, udid: str) -> Dict:
        """Get device capabilities"""
        capabilities = {
            'backup': False,
            'restore': False,
            'diagnostics': False,
            'dfu': False,
            'recovery': False,
        }
        
        # Check if idevicebackup is available
        if is_tool_available('idevicebackup'):
            capabilities['backup'] = True
            capabilities['restore'] = True
        
        # Check if idevicediagnostics is available
        if is_tool_available('idevicediagnostics'):
            capabilities['diagnostics'] = True
        
        # Check device mode (DFU/Recovery detection would require additional tools)
        try:
            result = subprocess.run(
                ['ideviceinfo', '-u', udid],
                capture_output=True,
                timeout=5,
                text=True
            )
            if result.returncode == 0:
                # If we can get device info, device is in normal mode
                capabilities['normal_mode'] = True
        except Exception:
            pass
        
        return capabilities
    
    def _get_metadata(self, udid: str) -> Dict:
        """Get additional metadata"""
        metadata = {
            'collection_method': 'libimobiledevice',
            'tools_available': {
                'ideviceinfo': is_tool_available('ideviceinfo'),
                'idevice_id': is_tool_available('idevice_id'),
                'idevicebackup': is_tool_available('idevicebackup'),
                'idevicediagnostics': is_tool_available('idevicediagnostics'),
            },
            'limitations': [
                'Battery information may be limited without jailbreak',
                'Some security information may require special entitlements',
                'DFU mode detection requires additional tools',
            ]
        }
        
        return metadata
    
    def get_battery_info(self, udid: str) -> Dict:
        """
        Get battery information only
        
        Args:
            udid: iOS device UDID
        
        Returns:
            Battery information dictionary
        """
        return self._get_battery_info(udid)
    
    def get_security_info(self, udid: str) -> Dict:
        """
        Get security information only
        
        Args:
            udid: iOS device UDID
        
        Returns:
            Security information dictionary
        """
        return self._get_security_info(udid)

# Global instance
_ios_dossier = None

def get_ios_dossier() -> iOSDossier:
    """Get global iOS dossier instance"""
    global _ios_dossier
    if _ios_dossier is None:
        _ios_dossier = iOSDossier()
    return _ios_dossier

# Convenience functions
def collect_ios_dossier(udid: str) -> Dict:
    """Collect iOS device dossier"""
    return get_ios_dossier().collect_dossier(udid)

def get_ios_battery_info(udid: str) -> Dict:
    """Get iOS battery information"""
    return get_ios_dossier().get_battery_info(udid)

def get_ios_security_info(udid: str) -> Dict:
    """Get iOS security information"""
    return get_ios_dossier().get_security_info(udid)
