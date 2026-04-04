/**
 * Hotplug Events API endpoints (v1)
 * 
 * Tracks device connection/disconnection events.
 * REST endpoint for polling; WebSocket for real-time.
 */

import express from 'express';

const router = express.Router();

// Event store - keeps last 100 events
const eventStore = {
  events: [],
  maxEvents: 100,
  
  add(event) {
    this.events.unshift({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      ...event
    });
    
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents);
    }
  },
  
  getRecent(limit = 50) {
    return this.events.slice(0, limit);
  },
  
  clear() {
    this.events = [];
  }
};

/**
 * Record a hotplug event (called internally when devices connect/disconnect)
 */
export function recordHotplugEvent(type, deviceInfo) {
  eventStore.add({
    type,
    device: deviceInfo
  });
}

/**
 * GET /api/v1/hotplug/events
 * Get recent hotplug device events
 * 
 * Query params:
 * - limit: number of events to return (default 50, max 100)
 * - since: ISO timestamp to filter events after
 */
router.get('/events', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const since = req.query.since ? new Date(req.query.since) : null;
  
  let events = eventStore.getRecent(limit);
  
  if (since && !isNaN(since.getTime())) {
    events = events.filter(e => new Date(e.timestamp) > since);
  }
  
  res.sendEnvelope({
    events,
    count: events.length,
    websocketEndpoint: '/ws/device-events',
    note: 'For real-time updates, connect to the WebSocket endpoint',
    timestamp: new Date().toISOString()
  });
});

/**
 * DELETE /api/v1/hotplug/events
 * Clear event history
 */
router.delete('/events', (req, res) => {
  const count = eventStore.events.length;
  eventStore.clear();
  
  res.sendEnvelope({
    cleared: true,
    count,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/v1/hotplug/status
 * Get hotplug monitoring status
 */
router.get('/status', (req, res) => {
  res.sendEnvelope({
    monitoring: true,
    eventCount: eventStore.events.length,
    maxEvents: eventStore.maxEvents,
    websocketEndpoint: '/ws/device-events',
    timestamp: new Date().toISOString()
  });
});

export default router;

