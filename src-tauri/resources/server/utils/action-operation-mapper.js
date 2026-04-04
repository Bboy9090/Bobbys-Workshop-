/**
 * Action-Operation Mapper
 * 
 * Maps action IDs from actions.json to executeOperation capability IDs
 * This bridges the workflow executor with the operations system
 */

/**
 * Map action ID to executeOperation capability ID
 */
export function mapActionToOperation(actionId) {
  const mapping = {
    // Android ADB actions
    'android.adb.devices': 'detect_android_adb',
    'android.adb.getprop': 'device_info', // Requires device_authorized gate
    'android.adb.bugreport': null, // Requires device_authorized + ownership_attested gates
    'android.adb.logcat.snapshot': null, // Requires device_authorized gate
    
    // Android Fastboot actions
    'android.fastboot.devices': 'detect_android_fastboot',
    'android.fastboot.getvar.all': 'device_info', // Requires fastboot mode
    
    // iOS actions
    'ios.ideviceinfo.identity': 'detect_ios_devices',
    'ios.irecovery.query': 'detect_ios_devices', // Recovery mode detection
    
    // System actions
    'system.usb.enumerate': 'detect_usb_devices',
    
    // Device intake actions (no operation mapping - handled in API)
    'device_intake_readonly': null,
    'status_assessment_readonly': null,
    'ownership_packet_collect': null,
    'support_bundle_export': null,
    'official_handoff_links': null,
    
    // Emit actions (no operation mapping - handled in workflow)
    'bobby.emit.device_passports': null,
  };
  
  return mapping[actionId] || null;
}

/**
 * Check if action requires device authorization
 */
export function requiresDeviceAuthorization(actionId) {
  const requiresAuth = [
    'android.adb.getprop',
    'android.adb.bugreport',
    'android.adb.logcat.snapshot',
    'device_intake_readonly', // May require device authorization
  ];
  
  return requiresAuth.includes(actionId);
}

/**
 * Check if action requires ownership attestation
 */
export function requiresOwnershipAttestation(actionId) {
  const requiresOwnership = [
    'android.adb.bugreport',
    'ownership_packet_collect',
  ];
  
  return requiresOwnership.includes(actionId);
}

/**
 * Get operation parameters from action and workflow context
 */
export function getOperationParams(actionId, action, context) {
  const { parameters } = context;
  
  // Map action-specific parameters
  const params = {};
  
  if (actionId.startsWith('android.adb.')) {
    params.platform = 'android';
    if (parameters?.serial) {
      params.serial = parameters.serial;
    }
  } else if (actionId.startsWith('ios.')) {
    params.platform = 'ios';
    if (parameters?.udid) {
      params.serial = parameters.udid;
    }
  } else if (actionId === 'device_info') {
    params.platform = parameters?.platform || 'unknown';
    params.serial = parameters?.serial;
  }
  
  return params;
}
