"""
🏆 Universal Device Dossier - 100% Real Implementation
Supports both Android and iOS devices
"""

from typing import Dict, Optional
from datetime import datetime
from .platform import Platform, get_platform_detector, detect_platform, get_device_info
from .ios_dossier import collect_ios_dossier, get_ios_dossier

def collect_dossier(identifier: Optional[str] = None, platform: Optional[str] = None) -> Dict:
    """
    Collect comprehensive device dossier (Android or iOS)
    
    Args:
        identifier: Device serial (Android) or UDID (iOS)
        platform: 'android', 'ios', or None (auto-detect)
    
    Returns:
        Dictionary with device dossier
    """
    detector = get_platform_detector()
    
    # Auto-detect platform if not provided
    if platform is None:
        if identifier:
            detected_platform = detect_platform(identifier)
            platform = detected_platform.value
        else:
            # Try to detect from connected devices
            devices = detector.detect_all_devices()
            if devices:
                platform = devices[0]['platform']
            else:
                return {
                    'success': False,
                    'error': 'No devices detected and no identifier provided'
                }
    
    # Collect dossier based on platform
    if platform == 'ios':
        if not identifier:
            # Get first iOS device
            devices = detector.detect_ios_devices()
            if not devices:
                return {
                    'success': False,
                    'error': 'No iOS devices detected'
                }
            identifier = devices[0].get('udid')
        
        return collect_ios_dossier(identifier)
    
    elif platform == 'android':
        if not identifier:
            # Get first Android device
            devices = detector.detect_android_devices()
            if not devices:
                return {
                    'success': False,
                    'error': 'No Android devices detected'
                }
            identifier = devices[0].get('serial')
        
        return _collect_android_dossier(identifier)
    
    else:
        return {
            'success': False,
            'error': f'Unsupported platform: {platform}'
        }

def _collect_android_dossier(serial: str) -> Dict:
    """
    Collect Android device dossier
    
    Args:
        serial: Android device serial
    
    Returns:
        Dictionary with Android device dossier
    """
    from .core import run_cmd
    
    dossier = {
        'success': True,
        'platform': 'android',
        'serial': serial,
        'timestamp': datetime.now().isoformat(),
        'device_info': {},
        'battery': {},
        'security': {},
        'performance': {},
        'metadata': {}
    }
    
    try:
        # Device information
        dossier['device_info'] = {
            'model': run_cmd(['adb', '-s', serial, 'shell', 'getprop', 'ro.product.model']).strip(),
            'manufacturer': run_cmd(['adb', '-s', serial, 'shell', 'getprop', 'ro.product.manufacturer']).strip(),
            'brand': run_cmd(['adb', '-s', serial, 'shell', 'getprop', 'ro.product.brand']).strip(),
            'device': run_cmd(['adb', '-s', serial, 'shell', 'getprop', 'ro.product.device']).strip(),
            'version': run_cmd(['adb', '-s', serial, 'shell', 'getprop', 'ro.build.version.release']).strip(),
            'sdk': run_cmd(['adb', '-s', serial, 'shell', 'getprop', 'ro.build.version.sdk']).strip(),
            'serial': serial,
        }
        
        # Battery information
        battery_level = run_cmd(['adb', '-s', serial, 'shell', 'dumpsys', 'battery', '|', 'grep', 'level']).strip()
        battery_status = run_cmd(['adb', '-s', serial, 'shell', 'dumpsys', 'battery', '|', 'grep', 'status']).strip()
        
        dossier['battery'] = {
            'available': True,
            'level': battery_level.split(':')[-1].strip() if battery_level else None,
            'status': battery_status.split(':')[-1].strip() if battery_status else None,
        }
        
        # Security information
        dossier['security'] = {
            'bootloader_unlocked': 'unlocked' in run_cmd(['adb', '-s', serial, 'shell', 'getprop', 'ro.boot.flash.locked']).strip().lower(),
            'root_available': run_cmd(['adb', '-s', serial, 'shell', 'which', 'su']).strip() != '',
            'selinux': run_cmd(['adb', '-s', serial, 'shell', 'getenforce']).strip(),
        }
        
        # Performance information
        dossier['performance'] = {
            'cpu_cores': run_cmd(['adb', '-s', serial, 'shell', 'cat', '/proc/cpuinfo', '|', 'grep', 'processor', '|', 'wc', '-l']).strip(),
            'ram_total': run_cmd(['adb', '-s', serial, 'shell', 'cat', '/proc/meminfo', '|', 'grep', 'MemTotal']).strip(),
        }
        
        # Metadata
        dossier['metadata'] = {
            'collection_method': 'adb',
            'tools_available': {
                'adb': True,
                'fastboot': run_cmd(['which', 'fastboot']).strip() != '',
            }
        }
        
    except Exception as e:
        dossier['success'] = False
        dossier['error'] = str(e)
    
    return dossier
