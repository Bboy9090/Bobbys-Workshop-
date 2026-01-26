/**
 * 🚀 Beyond World Class - Event Streaming System
 * 
 * High-throughput event streaming with:
 * - Event sourcing
 * - Real-time processing
 * - Event replay
 * - Stream processing
 */

import { EventEmitter } from 'events';

class EventStream extends EventEmitter {
  constructor() {
    super();
    this.streams = new Map();
    this.subscribers = new Map();
    this.eventHistory = [];
    this.maxHistorySize = 10000;
  }

  // Create a new event stream
  createStream(streamId, config = {}) {
    const stream = {
      id: streamId,
      events: [],
      subscribers: new Set(),
      config: {
        maxSize: config.maxSize || 1000,
        retention: config.retention || 3600000, // 1 hour
        ...config,
      },
      createdAt: new Date().toISOString(),
    };

    this.streams.set(streamId, stream);
    return stream;
  }

  // Publish event to stream
  publish(streamId, event) {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new Error(`Stream ${streamId} does not exist`);
    }

    const eventWithMetadata = {
      id: `event-${Date.now()}-${Math.random()}`,
      streamId,
      type: event.type,
      data: event.data,
      metadata: {
        timestamp: new Date().toISOString(),
        version: event.version || '1.0',
        ...event.metadata,
      },
    };

    // Add to stream
    stream.events.push(eventWithMetadata);

    // Maintain stream size
    if (stream.events.length > stream.config.maxSize) {
      stream.events.shift();
    }

    // Add to global history
    this.eventHistory.push(eventWithMetadata);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Notify subscribers
    this._notifySubscribers(streamId, eventWithMetadata);

    // Emit global event
    this.emit('event', eventWithMetadata);
    this.emit(`stream:${streamId}`, eventWithMetadata);

    return eventWithMetadata.id;
  }

  // Subscribe to stream
  subscribe(streamId, callback) {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new Error(`Stream ${streamId} does not exist`);
    }

    const subscriberId = `sub-${Date.now()}-${Math.random()}`;
    stream.subscribers.add(subscriberId);

    if (!this.subscribers.has(streamId)) {
      this.subscribers.set(streamId, new Map());
    }

    this.subscribers.get(streamId).set(subscriberId, callback);

    // Send recent events to new subscriber
    const recentEvents = stream.events.slice(-10);
    for (const event of recentEvents) {
      callback(event);
    }

    return subscriberId;
  }

  // Unsubscribe from stream
  unsubscribe(streamId, subscriberId) {
    const stream = this.streams.get(streamId);
    if (stream) {
      stream.subscribers.delete(subscriberId);
    }

    const subscribers = this.subscribers.get(streamId);
    if (subscribers) {
      subscribers.delete(subscriberId);
    }
  }

  // Get stream events
  getStreamEvents(streamId, limit = 100) {
    const stream = this.streams.get(streamId);
    if (!stream) {
      return [];
    }

    return stream.events.slice(-limit).reverse();
  }

  // Replay events from stream
  replayStream(streamId, fromTimestamp = null, callback) {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new Error(`Stream ${streamId} does not exist`);
    }

    let events = stream.events;
    if (fromTimestamp) {
      events = events.filter(e => new Date(e.metadata.timestamp) >= new Date(fromTimestamp));
    }

    for (const event of events) {
      callback(event);
    }

    return events.length;
  }

  // Process stream with function
  async processStream(streamId, processor, options = {}) {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new Error(`Stream ${streamId} does not exist`);
    }

    const { batchSize = 10, concurrency = 1 } = options;
    const events = stream.events.slice(-batchSize);

    const results = [];
    for (let i = 0; i < events.length; i += concurrency) {
      const batch = events.slice(i, i + concurrency);
      const batchResults = await Promise.all(batch.map(processor));
      results.push(...batchResults);
    }

    return results;
  }

  _notifySubscribers(streamId, event) {
    const subscribers = this.subscribers.get(streamId);
    if (subscribers) {
      for (const callback of subscribers.values()) {
        try {
          callback(event);
        } catch (error) {
          console.error(`Error in subscriber callback: ${error.message}`);
        }
      }
    }
  }

  // Get all streams
  getAllStreams() {
    return Array.from(this.streams.values()).map(stream => ({
      id: stream.id,
      eventCount: stream.events.length,
      subscriberCount: stream.subscribers.size,
      createdAt: stream.createdAt,
    }));
  }

  // Get stream statistics
  getStreamStats(streamId) {
    const stream = this.streams.get(streamId);
    if (!stream) {
      return null;
    }

    const events = stream.events;
    const eventTypes = {};
    for (const event of events) {
      eventTypes[event.type] = (eventTypes[event.type] || 0) + 1;
    }

    return {
      id: stream.id,
      eventCount: events.length,
      subscriberCount: stream.subscribers.size,
      eventTypes,
      oldestEvent: events[0]?.metadata.timestamp,
      newestEvent: events[events.length - 1]?.metadata.timestamp,
    };
  }
}

export default new EventStream();
