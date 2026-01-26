import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Ticket, Plus, Search, Filter } from '@phosphor-icons/react';
import { io } from 'socket.io-client';

interface Customer {
  id?: string;
  name: string;
  contact: string;
  email?: string;
}

interface Device {
  brand: string;
  model: string;
  serial?: string;
  imei?: string;
  condition?: string;
}

interface RepairTicket {
  id: string;
  ticketNumber: string;
  customer: Customer;
  device: Device;
  issueDescription: string;
  status: string;
  priority: string;
  estimatedCost: number | null;
  actualCost: number | null;
  createdAt: string;
  updatedAt: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export function RepairTicketManager() {
  const [tickets, setTickets] = useState<RepairTicket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<RepairTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [socket, setSocket] = useState<any>(null);

  // Form state for creating new ticket
  const [newTicket, setNewTicket] = useState({
    customerName: '',
    customerContact: '',
    customerEmail: '',
    deviceBrand: '',
    deviceModel: '',
    deviceSerial: '',
    deviceImei: '',
    issueDescription: '',
    estimatedCost: '',
    priority: 'medium'
  });

  // Initialize Socket.IO connection
  useEffect(() => {
    const socketInstance = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });

    socketInstance.on('connect', () => {
      console.log('Connected to Socket.IO server');
    });

    socketInstance.on('ticket-updated', (data) => {
      console.log('Ticket updated:', data);
      // Update the ticket in the list
      setTickets(prev => prev.map(t => 
        t.id === data.ticketId ? data.ticket : t
      ));
    });

    socketInstance.on('repair-progress', (data) => {
      console.log('Repair progress:', data);
      // You can show toast notifications here
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Fetch tickets from API
  useEffect(() => {
    fetchTickets();
  }, []);

  // Filter tickets when search or filter changes
  useEffect(() => {
    let filtered = tickets;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(t => 
        t.ticketNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.device.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.device.model.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredTickets(filtered);
  }, [tickets, searchTerm, statusFilter]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/v1/repair-tickets`);
      const data = await response.json();
      
      if (data.success) {
        setTickets(data.tickets);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTicket = async () => {
    try {
      const response = await fetch(`${API_URL}/api/v1/repair-tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customer: {
            name: newTicket.customerName,
            contact: newTicket.customerContact,
            email: newTicket.customerEmail || undefined
          },
          device: {
            brand: newTicket.deviceBrand,
            model: newTicket.deviceModel,
            serial: newTicket.deviceSerial || undefined,
            imei: newTicket.deviceImei || undefined
          },
          issueDescription: newTicket.issueDescription,
          estimatedCost: newTicket.estimatedCost ? parseFloat(newTicket.estimatedCost) : null,
          priority: newTicket.priority
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setTickets(prev => [...prev, data.ticket]);
        setIsCreateDialogOpen(false);
        // Reset form
        setNewTicket({
          customerName: '',
          customerContact: '',
          customerEmail: '',
          deviceBrand: '',
          deviceModel: '',
          deviceSerial: '',
          deviceImei: '',
          issueDescription: '',
          estimatedCost: '',
          priority: 'medium'
        });
      }
    } catch (error) {
      console.error('Error creating ticket:', error);
    }
  };

  const updateTicketStatus = async (ticketId: string, newStatus: string) => {
    try {
      const response = await fetch(`${API_URL}/api/v1/repair-tickets/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: newStatus
        })
      });

      const data = await response.json();
      
      if (data.success && socket) {
        // Subscribe to ticket updates
        socket.emit('subscribe-repair-ticket', ticketId);
      }
    } catch (error) {
      console.error('Error updating ticket:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-500';
      case 'in-progress': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-green-600';
      case 'medium': return 'bg-yellow-600';
      case 'high': return 'bg-orange-600';
      case 'urgent': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Ticket size={32} className="text-primary" />
          <div>
            <h2 className="text-2xl font-bold">Repair Tickets</h2>
            <p className="text-sm text-muted-foreground">
              Manage customer repair tickets and track progress
            </p>
          </div>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus size={20} className="mr-2" />
              Create Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Repair Ticket</DialogTitle>
              <DialogDescription>
                Enter customer and device information to create a repair ticket
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Customer Information */}
              <div className="space-y-2">
                <h3 className="font-semibold">Customer Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="customerName">Name *</Label>
                    <Input
                      id="customerName"
                      value={newTicket.customerName}
                      onChange={(e) => setNewTicket({...newTicket, customerName: e.target.value})}
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <Label htmlFor="customerContact">Contact *</Label>
                    <Input
                      id="customerContact"
                      value={newTicket.customerContact}
                      onChange={(e) => setNewTicket({...newTicket, customerContact: e.target.value})}
                      placeholder="+1234567890"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="customerEmail">Email</Label>
                    <Input
                      id="customerEmail"
                      type="email"
                      value={newTicket.customerEmail}
                      onChange={(e) => setNewTicket({...newTicket, customerEmail: e.target.value})}
                      placeholder="john@example.com"
                    />
                  </div>
                </div>
              </div>

              {/* Device Information */}
              <div className="space-y-2">
                <h3 className="font-semibold">Device Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="deviceBrand">Brand *</Label>
                    <Input
                      id="deviceBrand"
                      value={newTicket.deviceBrand}
                      onChange={(e) => setNewTicket({...newTicket, deviceBrand: e.target.value})}
                      placeholder="Samsung"
                    />
                  </div>
                  <div>
                    <Label htmlFor="deviceModel">Model *</Label>
                    <Input
                      id="deviceModel"
                      value={newTicket.deviceModel}
                      onChange={(e) => setNewTicket({...newTicket, deviceModel: e.target.value})}
                      placeholder="Galaxy S21"
                    />
                  </div>
                  <div>
                    <Label htmlFor="deviceSerial">Serial Number</Label>
                    <Input
                      id="deviceSerial"
                      value={newTicket.deviceSerial}
                      onChange={(e) => setNewTicket({...newTicket, deviceSerial: e.target.value})}
                      placeholder="ABC123XYZ"
                    />
                  </div>
                  <div>
                    <Label htmlFor="deviceImei">IMEI</Label>
                    <Input
                      id="deviceImei"
                      value={newTicket.deviceImei}
                      onChange={(e) => setNewTicket({...newTicket, deviceImei: e.target.value})}
                      placeholder="123456789012345"
                    />
                  </div>
                </div>
              </div>

              {/* Issue & Pricing */}
              <div className="space-y-2">
                <h3 className="font-semibold">Issue & Pricing</h3>
                <div>
                  <Label htmlFor="issueDescription">Issue Description *</Label>
                  <Textarea
                    id="issueDescription"
                    value={newTicket.issueDescription}
                    onChange={(e) => setNewTicket({...newTicket, issueDescription: e.target.value})}
                    placeholder="Describe the issue..."
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="estimatedCost">Estimated Cost ($)</Label>
                    <Input
                      id="estimatedCost"
                      type="number"
                      value={newTicket.estimatedCost}
                      onChange={(e) => setNewTicket({...newTicket, estimatedCost: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={newTicket.priority}
                      onValueChange={(value) => setNewTicket({...newTicket, priority: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Button onClick={createTicket} className="w-full">
                Create Ticket
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                <Input
                  placeholder="Search by ticket number, customer name, or device..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter size={16} className="mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      {loading ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading tickets...</p>
          </CardContent>
        </Card>
      ) : filteredTickets.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">No repair tickets found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredTickets.map((ticket) => (
            <Card key={ticket.id} className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{ticket.ticketNumber}</CardTitle>
                    <CardDescription>
                      {ticket.customer.name} • {ticket.customer.contact}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge className={getStatusColor(ticket.status)}>
                      {ticket.status}
                    </Badge>
                    <Badge className={getPriorityColor(ticket.priority)}>
                      {ticket.priority}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Device:</span>
                    <span>{ticket.device.brand} {ticket.device.model}</span>
                  </div>
                  {ticket.device.serial && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Serial:</span>
                      <span className="font-mono">{ticket.device.serial}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Issue:</span>
                    <span className="text-muted-foreground text-right max-w-md truncate">
                      {ticket.issueDescription}
                    </span>
                  </div>
                  {ticket.estimatedCost && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Estimated Cost:</span>
                      <span>${ticket.estimatedCost.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Created:</span>
                    <span>{new Date(ticket.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                
                <div className="mt-4 flex gap-2">
                  {ticket.status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={() => updateTicketStatus(ticket.id, 'in-progress')}
                    >
                      Start Repair
                    </Button>
                  )}
                  {ticket.status === 'in-progress' && (
                    <Button
                      size="sm"
                      onClick={() => updateTicketStatus(ticket.id, 'completed')}
                    >
                      Mark Complete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
