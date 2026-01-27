# Diagnostic and Repair App Features

This document describes the newly implemented diagnostic and repair management features for Phoenix Forge.

## Overview

Phoenix Forge now includes comprehensive repair ticket management, real-time progress tracking, and automated diagnostics for both Android and iOS devices.

## Features

### 1. Repair Ticket Management

Full CRUD API for managing repair tickets with customer information, device details, and repair tracking.

#### API Endpoints

**Base URL**: `/api/v1/repair-tickets`

##### Get All Tickets
```http
GET /api/v1/repair-tickets?status=pending&customerId=xxx&deviceSerial=xxx
```

Query Parameters:
- `status` (optional): Filter by status (pending, in-progress, completed, cancelled)
- `customerId` (optional): Filter by customer ID
- `deviceSerial` (optional): Filter by device serial number

Response:
```json
{
  "success": true,
  "tickets": [...],
  "total": 10
}
```

##### Get Single Ticket
```http
GET /api/v1/repair-tickets/:id
```

##### Create Ticket
```http
POST /api/v1/repair-tickets
Content-Type: application/json

{
  "customer": {
    "name": "John Doe",
    "contact": "+1234567890",
    "email": "john@example.com"
  },
  "device": {
    "brand": "Samsung",
    "model": "Galaxy S21",
    "serial": "ABC123XYZ",
    "imei": "123456789012345",
    "condition": "good"
  },
  "issueDescription": "Screen cracked, needs replacement",
  "estimatedCost": 150.00,
  "priority": "high"
}
```

##### Update Ticket
```http
PATCH /api/v1/repair-tickets/:id
Content-Type: application/json

{
  "status": "in-progress",
  "actualCost": 175.00,
  "note": "Screen replaced successfully"
}
```

##### Delete Ticket
```http
DELETE /api/v1/repair-tickets/:id
```

##### Generate QR Code Data
```http
POST /api/v1/repair-tickets/:id/qr-code
```

Returns JSON data that can be encoded into a QR code for tracking.

### 2. Real-Time Updates with Socket.IO

Real-time progress tracking for repair operations using Socket.IO.

#### Connection

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001', {
  path: '/socket.io',
  transports: ['websocket', 'polling']
});
```

#### Events

##### Subscribe to Ticket Updates
```javascript
socket.emit('subscribe-repair-ticket', ticketId);
```

##### Receive Ticket Updates
```javascript
socket.on('ticket-updated', (data) => {
  console.log('Ticket updated:', data);
  // data = { ticketId, ticket, timestamp }
});
```

##### Receive Repair Progress
```javascript
socket.on('repair-progress', (data) => {
  console.log('Progress:', data);
  // data = { ticketId, message, percentage, timestamp }
});
```

##### Receive Flash Progress
```javascript
socket.on('flash-progress', (data) => {
  console.log('Flash progress:', data);
  // data = { deviceId, progress, timestamp }
});
```

##### Receive Diagnostics Results
```javascript
socket.on('diagnostics-result', (data) => {
  console.log('Diagnostics:', data);
  // data = { deviceId, results, timestamp }
});
```

##### Receive Device State Changes
```javascript
socket.on('device-state-change', (data) => {
  console.log('Device state:', data);
  // data = { deviceId, state, timestamp }
});
```

### 3. Android Diagnostics Script

Automated diagnostics for Android devices using ADB.

#### Location
`server/scripts/android-diagnostics.js`

#### Usage

```javascript
import AndroidDiagnostics from './scripts/android-diagnostics.js';

const diagnostics = new AndroidDiagnostics();

// Check if ADB is available
const adbCheck = await diagnostics.checkAdbAvailable();

// List connected devices
const devices = await diagnostics.listDevices();

// Get device properties
const props = await diagnostics.getDeviceProperties(serial);

// Get battery information
const battery = await diagnostics.getBatteryInfo(serial);

// Get device state
const state = await diagnostics.getDeviceState(serial);

// Enter Fastboot mode
await diagnostics.enterFastboot(serial);

// Enter Recovery mode
await diagnostics.enterRecovery(serial);

// Reboot device
await diagnostics.rebootDevice(serial);

// Run comprehensive diagnostics
const results = await diagnostics.runComprehensiveDiagnostics(serial);
```

#### CLI Usage

```bash
node server/scripts/android-diagnostics.js
```

### 4. iOS Diagnostics Script

Automated diagnostics for iOS devices using libimobiledevice.

#### Location
`server/scripts/ios-diagnostics.js`

#### Prerequisites

**macOS**:
```bash
brew install libimobiledevice
```

**Linux**:
```bash
sudo apt-get install libimobiledevice-utils
```

#### Usage

```javascript
import IOSDiagnostics from './scripts/ios-diagnostics.js';

const diagnostics = new IOSDiagnostics();

// Check if tools are available
const toolsCheck = await diagnostics.checkToolsAvailable();

// List connected devices
const devices = await diagnostics.listDevices();

// Get device information
const info = await diagnostics.getDeviceInfo(udid);

// Get battery information
const battery = await diagnostics.getBatteryInfo(udid);

// Enter Recovery mode
await diagnostics.enterRecoveryMode(udid);

// Exit Recovery mode
await diagnostics.exitRecoveryMode(udid);

// Reboot device
await diagnostics.rebootDevice(udid);

// Run comprehensive diagnostics
const results = await diagnostics.runComprehensiveDiagnostics(udid);
```

### 5. Frontend Component

React component for managing repair tickets with real-time updates.

#### Location
`src/components/RepairTicketManager.tsx`

#### Features
- Create new repair tickets
- View all tickets with filtering
- Search by ticket number, customer name, or device
- Filter by status
- Real-time ticket updates via Socket.IO
- Status management (pending → in-progress → completed)
- Customer and device information management
- Cost tracking (estimated and actual)

#### Usage

```tsx
import { RepairTicketManager } from './components/RepairTicketManager';

function App() {
  return (
    <div>
      <RepairTicketManager />
    </div>
  );
}
```

## Environment Variables

### Frontend (.env)

```env
VITE_API_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
```

### Backend (server/.env)

```env
NODE_ENV=development
PORT=3001
DEMO_MODE=0
```

## Running the Application

### Start Backend

```bash
cd server
npm install
npm start
```

The backend will start on `http://localhost:3001`

### Start Frontend

```bash
npm install
npm run dev
```

The frontend will start on `http://localhost:5173`

## Testing

### Test Repair Ticket API

```bash
# Create a ticket
curl -X POST http://localhost:3001/api/v1/repair-tickets \
  -H "Content-Type: application/json" \
  -d '{
    "customer": {
      "name": "Test Customer",
      "contact": "+1234567890"
    },
    "device": {
      "brand": "Samsung",
      "model": "Galaxy S21"
    },
    "issueDescription": "Test issue",
    "priority": "medium"
  }'

# Get all tickets
curl http://localhost:3001/api/v1/repair-tickets

# Get specific ticket
curl http://localhost:3001/api/v1/repair-tickets/{ticket-id}

# Update ticket status
curl -X PATCH http://localhost:3001/api/v1/repair-tickets/{ticket-id} \
  -H "Content-Type: application/json" \
  -d '{"status": "in-progress"}'
```

### Test Socket.IO Connection

Open browser console and run:

```javascript
const socket = io('http://localhost:3001', { path: '/socket.io' });

socket.on('connect', () => {
  console.log('Connected!');
  socket.emit('subscribe-repair-ticket', 'ticket-id');
});

socket.on('ticket-updated', (data) => {
  console.log('Update:', data);
});
```

### Test Android Diagnostics

```bash
# Ensure device is connected via ADB
adb devices

# Run diagnostics
node server/scripts/android-diagnostics.js
```

### Test iOS Diagnostics

```bash
# Ensure device is connected
idevice_id -l

# Run diagnostics (when implemented in CLI)
node server/scripts/ios-diagnostics.js
```

## Security Considerations

1. **Authentication**: Add authentication middleware for production
2. **Input Validation**: All inputs are validated on the backend
3. **CORS**: Configure CORS appropriately for production
4. **Rate Limiting**: Consider adding rate limiting for API endpoints
5. **Data Sanitization**: Sanitize all user inputs before storage

## Future Enhancements

- [ ] QR code generation and scanning on frontend
- [ ] Photo attachment for device condition
- [ ] Email notifications for ticket status changes
- [ ] SMS notifications via Twilio
- [ ] Firebase Cloud Messaging integration
- [ ] Print receipt/invoice functionality
- [ ] Parts inventory management
- [ ] Technician assignment system
- [ ] Customer portal for ticket tracking
- [ ] Analytics dashboard for repair shop metrics

## Troubleshooting

### Socket.IO Not Connecting

1. Check that backend is running on correct port
2. Verify CORS configuration
3. Check browser console for errors
4. Try different transport (websocket vs polling)

### ADB Not Found

```bash
# macOS
brew install android-platform-tools

# Linux
sudo apt-get install android-tools-adb android-tools-fastboot

# Windows
Download from https://developer.android.com/studio/releases/platform-tools
```

### libimobiledevice Not Found

```bash
# macOS
brew install libimobiledevice

# Linux
sudo apt-get install libimobiledevice-utils

# Windows
Not officially supported, use WSL
```

## License

MIT License - See [LICENSE](../LICENSE) for details.
