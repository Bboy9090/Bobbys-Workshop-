import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import structuredLogger from '../../utils/observability/structured-logger.js';
import { emitTicketUpdate, emitRepairProgress } from '../../utils/socketio-events.js';

const router = express.Router();

// In-memory storage (replace with database in production)
const tickets = new Map();

/**
 * @route GET /api/v1/repair-tickets
 * @desc Get all repair tickets with optional filtering
 */
router.get('/', (req, res) => {
  const { status, customerId, deviceSerial } = req.query;
  
  let filteredTickets = Array.from(tickets.values());
  
  if (status) {
    filteredTickets = filteredTickets.filter(t => t.status === status);
  }
  
  if (customerId) {
    filteredTickets = filteredTickets.filter(t => t.customer.id === customerId);
  }
  
  if (deviceSerial) {
    filteredTickets = filteredTickets.filter(t => t.device.serial === deviceSerial);
  }
  
  structuredLogger.info('Fetched repair tickets', {
    count: filteredTickets.length,
    filters: { status, customerId, deviceSerial }
  });
  
  res.json({
    success: true,
    tickets: filteredTickets,
    total: filteredTickets.length
  });
});

/**
 * @route GET /api/v1/repair-tickets/:id
 * @desc Get a specific repair ticket by ID
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const ticket = tickets.get(id);
  
  if (!ticket) {
    return res.status(404).json({
      success: false,
      error: 'Ticket not found'
    });
  }
  
  res.json({
    success: true,
    ticket
  });
});

/**
 * @route POST /api/v1/repair-tickets
 * @desc Create a new repair ticket
 */
router.post('/', (req, res) => {
  try {
    const {
      customer,
      device,
      issueDescription,
      estimatedCost,
      priority = 'medium'
    } = req.body;
    
    // Validate required fields
    if (!customer || !customer.name || !customer.contact) {
      return res.status(400).json({
        success: false,
        error: 'Customer name and contact are required'
      });
    }
    
    if (!device || !device.brand || !device.model) {
      return res.status(400).json({
        success: false,
        error: 'Device brand and model are required'
      });
    }
    
    if (!issueDescription) {
      return res.status(400).json({
        success: false,
        error: 'Issue description is required'
      });
    }
    
    const ticketId = uuidv4();
    const ticket = {
      id: ticketId,
      ticketNumber: `TKT-${Date.now().toString().slice(-8)}`,
      customer: {
        id: customer.id || uuidv4(),
        name: customer.name,
        contact: customer.contact,
        email: customer.email || null
      },
      device: {
        brand: device.brand,
        model: device.model,
        serial: device.serial || null,
        imei: device.imei || null,
        condition: device.condition || 'unknown'
      },
      issueDescription,
      status: 'pending',
      priority,
      estimatedCost: estimatedCost || null,
      actualCost: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      statusHistory: [
        {
          status: 'pending',
          timestamp: new Date().toISOString(),
          note: 'Ticket created'
        }
      ],
      notes: []
    };
    
    tickets.set(ticketId, ticket);
    
    structuredLogger.info('Created repair ticket', {
      ticketId,
      ticketNumber: ticket.ticketNumber,
      customer: customer.name,
      device: `${device.brand} ${device.model}`
    });
    
    res.status(201).json({
      success: true,
      ticket
    });
  } catch (error) {
    structuredLogger.error('Failed to create repair ticket', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to create repair ticket'
    });
  }
});

/**
 * @route PATCH /api/v1/repair-tickets/:id
 * @desc Update a repair ticket
 */
router.patch('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const ticket = tickets.get(id);
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }
    
    const {
      status,
      estimatedCost,
      actualCost,
      priority,
      note
    } = req.body;
    
    // Update fields if provided
    if (status && status !== ticket.status) {
      ticket.status = status;
      ticket.statusHistory.push({
        status,
        timestamp: new Date().toISOString(),
        note: note || `Status changed to ${status}`
      });
    }
    
    if (estimatedCost !== undefined) {
      ticket.estimatedCost = estimatedCost;
    }
    
    if (actualCost !== undefined) {
      ticket.actualCost = actualCost;
    }
    
    if (priority !== undefined) {
      ticket.priority = priority;
    }
    
    if (note && !status) {
      ticket.notes.push({
        timestamp: new Date().toISOString(),
        note
      });
    }
    
    ticket.updatedAt = new Date().toISOString();
    
    structuredLogger.info('Updated repair ticket', {
      ticketId: id,
      updates: Object.keys(req.body)
    });
    
    // Emit real-time update via Socket.IO
    emitTicketUpdate(id, ticket);
    if (status) {
      emitRepairProgress(id, `Status changed to ${status}`, 
        status === 'completed' ? 100 : status === 'in-progress' ? 50 : 10);
    }
    
    res.json({
      success: true,
      ticket
    });
  } catch (error) {
    structuredLogger.error('Failed to update repair ticket', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to update repair ticket'
    });
  }
});

/**
 * @route DELETE /api/v1/repair-tickets/:id
 * @desc Delete a repair ticket
 */
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  if (!tickets.has(id)) {
    return res.status(404).json({
      success: false,
      error: 'Ticket not found'
    });
  }
  
  tickets.delete(id);
  
  structuredLogger.info('Deleted repair ticket', { ticketId: id });
  
  res.json({
    success: true,
    message: 'Ticket deleted successfully'
  });
});

/**
 * @route POST /api/v1/repair-tickets/:id/qr-code
 * @desc Generate QR code for a ticket (returns data to be encoded)
 */
router.post('/:id/qr-code', (req, res) => {
  const { id } = req.params;
  const ticket = tickets.get(id);
  
  if (!ticket) {
    return res.status(404).json({
      success: false,
      error: 'Ticket not found'
    });
  }
  
  const qrData = {
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    customer: ticket.customer.name,
    device: `${ticket.device.brand} ${ticket.device.model}`,
    serial: ticket.device.serial,
    status: ticket.status,
    url: `${req.protocol}://${req.get('host')}/tickets/${ticket.id}`
  };
  
  res.json({
    success: true,
    qrData: JSON.stringify(qrData)
  });
});

export default router;
