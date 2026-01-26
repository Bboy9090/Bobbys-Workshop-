/**
 * 🚀 Beyond World Class - Event Streaming API
 */

import express from 'express';
import eventStream from '../../../utils/beyond/event-stream.js';

const router = express.Router();

/**
 * POST /api/v1/beyond/streaming/streams
 * Create event stream
 */
router.post('/streams', (req, res) => {
  try {
    const { streamId, config } = req.body;
    const stream = eventStream.createStream(streamId, config);
    
    res.json({
      envelope: {
        version: '1.0',
        operation: 'create_stream',
        mode: 'write',
        timestamp: new Date().toISOString(),
      },
      data: stream,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'create_stream',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * POST /api/v1/beyond/streaming/streams/:streamId/events
 * Publish event to stream
 */
router.post('/streams/:streamId/events', (req, res) => {
  try {
    const { streamId } = req.params;
    const eventId = eventStream.publish(streamId, req.body);
    
    res.json({
      envelope: {
        version: '1.0',
        operation: 'publish_event',
        mode: 'write',
        timestamp: new Date().toISOString(),
      },
      data: { eventId, message: 'Event published successfully' },
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'publish_event',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * GET /api/v1/beyond/streaming/streams/:streamId/events
 * Get stream events
 */
router.get('/streams/:streamId/events', (req, res) => {
  try {
    const { streamId } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const events = eventStream.getStreamEvents(streamId, limit);
    
    res.json({
      envelope: {
        version: '1.0',
        operation: 'get_stream_events',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: { events, count: events.length },
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'get_stream_events',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * GET /api/v1/beyond/streaming/streams
 * Get all streams
 */
router.get('/streams', (req, res) => {
  try {
    const streams = eventStream.getAllStreams();
    
    res.json({
      envelope: {
        version: '1.0',
        operation: 'get_streams',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: { streams, count: streams.length },
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'get_streams',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * GET /api/v1/beyond/streaming/streams/:streamId/stats
 * Get stream statistics
 */
router.get('/streams/:streamId/stats', (req, res) => {
  try {
    const { streamId } = req.params;
    const stats = eventStream.getStreamStats(streamId);
    
    if (!stats) {
      return res.status(404).json({
        envelope: {
          version: '1.0',
          operation: 'get_stream_stats',
          mode: 'error',
          timestamp: new Date().toISOString(),
        },
        error: { message: 'Stream not found' },
      });
    }

    res.json({
      envelope: {
        version: '1.0',
        operation: 'get_stream_stats',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'get_stream_stats',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

export default router;
