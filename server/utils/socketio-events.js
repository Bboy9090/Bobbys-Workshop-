/**
 * Socket.IO event emitters for real-time updates
 */

let ioInstance = null;

/**
 * Initialize Socket.IO instance
 * @param {import('socket.io').Server} io - Socket.IO server instance
 */
export function initSocketIO(io) {
  ioInstance = io;
}

/**
 * Emit repair ticket update to subscribed clients
 * @param {string} ticketId - Ticket ID
 * @param {Object} ticket - Updated ticket data
 */
export function emitTicketUpdate(ticketId, ticket) {
  if (!ioInstance) {
    console.warn('Socket.IO not initialized');
    return;
  }
  
  ioInstance.to(`ticket-${ticketId}`).emit('ticket-updated', {
    ticketId,
    ticket,
    timestamp: new Date().toISOString()
  });
}

/**
 * Emit firmware flash progress update
 * @param {string} deviceId - Device ID
 * @param {Object} progress - Progress data
 */
export function emitFlashProgress(deviceId, progress) {
  if (!ioInstance) {
    console.warn('Socket.IO not initialized');
    return;
  }
  
  ioInstance.emit('flash-progress', {
    deviceId,
    progress,
    timestamp: new Date().toISOString()
  });
}

/**
 * Emit diagnostics result
 * @param {string} deviceId - Device ID
 * @param {Object} results - Diagnostics results
 */
export function emitDiagnosticsResult(deviceId, results) {
  if (!ioInstance) {
    console.warn('Socket.IO not initialized');
    return;
  }
  
  ioInstance.emit('diagnostics-result', {
    deviceId,
    results,
    timestamp: new Date().toISOString()
  });
}

/**
 * Emit device state change
 * @param {string} deviceId - Device ID
 * @param {string} state - New state (e.g., 'fastboot', 'recovery', 'normal')
 */
export function emitDeviceStateChange(deviceId, state) {
  if (!ioInstance) {
    console.warn('Socket.IO not initialized');
    return;
  }
  
  ioInstance.emit('device-state-change', {
    deviceId,
    state,
    timestamp: new Date().toISOString()
  });
}

/**
 * Emit repair progress notification
 * @param {string} ticketId - Ticket ID
 * @param {string} message - Progress message
 * @param {number} percentage - Progress percentage (0-100)
 */
export function emitRepairProgress(ticketId, message, percentage) {
  if (!ioInstance) {
    console.warn('Socket.IO not initialized');
    return;
  }
  
  ioInstance.to(`ticket-${ticketId}`).emit('repair-progress', {
    ticketId,
    message,
    percentage,
    timestamp: new Date().toISOString()
  });
}
