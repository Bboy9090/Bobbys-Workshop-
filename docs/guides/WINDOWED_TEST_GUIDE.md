# 🪟 Windowed Production Build Test Guide

**Date:** 2025-01-27  
**Status:** ✅ Production Build Running in Windowed Mode

---

## ✅ BUILD STATUS

### Production Frontend
- ✅ Built successfully (`npm run build`)
- ✅ Served via Vite preview on port 5173
- ✅ Production assets optimized and ready

### Tauri Desktop App
- ✅ Running in windowed mode (`npm run tauri:dev`)
- ✅ Connected to production build server
- ✅ Window: 1400x900, resizable

### Backend Server
- ✅ Running on port 3001
- ✅ All Universal Legend Status endpoints operational

---

## 🧪 TESTING CHECKLIST

### 1. Window Verification ✅
- [x] Tauri window opens (1400x900)
- [x] Title: "Phoenix Forge - Device Repair Platform"
- [x] Window is resizable
- [x] UI loads correctly

### 2. Navigation to Observability Dashboard
1. Click on **"Monitoring"** tab in the sidebar
2. You should see three sub-tabs:
   - **Observability** ← This is the Universal Legend Status dashboard
   - **Device Metrics**
   - **Logs**
3. Click on **"Observability"** sub-tab

### 3. Universal Legend Status Features to Test

#### A. Metrics Dashboard
- **Real-time Metrics Cards:**
  - HTTP Requests (total, active, duration)
  - Operations (total, active, duration)
  - Device Connections
  - Errors
  - System Memory Usage
  - System CPU Usage

- **Metrics Charts:**
  - Request rate over time
  - Error rate over time
  - Memory usage trends
  - CPU usage trends

#### B. Traces View
- Active traces list
- Trace details with spans
- Request correlation IDs

#### C. Health Status
- Overall system health
- Circuit breaker status
- Recovery statistics
- Degradation status

### 4. API Endpoint Testing

Open browser DevTools (F12) and test these endpoints:

```javascript
// Observability Metrics
fetch('http://localhost:3001/api/v1/observability/metrics/summary')
  .then(r => r.json())
  .then(console.log);

// Platform Detection
fetch('http://localhost:3001/api/v1/universal/platform')
  .then(r => r.json())
  .then(console.log);

// Reliability Health
fetch('http://localhost:3001/api/v1/reliability/health')
  .then(r => r.json())
  .then(console.log);

// Prometheus Metrics
fetch('http://localhost:3001/api/v1/observability/metrics?format=prometheus')
  .then(r => r.text())
  .then(console.log);
```

---

## 📊 EXPECTED RESULTS

### Observability Dashboard Should Show:
1. **Metrics Summary:**
   - Total metrics: ~12
   - Counters: 4
   - Gauges: 5
   - Histograms: 3
   - Uptime in seconds

2. **Platform Information:**
   - OS: Windows 10/11
   - Architecture: x86_64
   - Capabilities: ADB, Fastboot, Rust, Python, Node.js

3. **Health Status:**
   - Overall: healthy or degraded
   - Circuit breakers: 5 total, all healthy
   - Recovery: statistics available
   - Validation: passed

4. **Real-time Updates:**
   - Metrics refresh every few seconds
   - Charts update with new data points
   - Request counts increment as you navigate

---

## 🐛 TROUBLESHOOTING

### Window Not Opening?
1. Check if port 5173 is available
2. Verify Vite preview is running: `http://localhost:5173`
3. Check Tauri logs in the terminal

### Dashboard Not Loading?
1. Verify backend is running: `http://localhost:3001/api/v1/health`
2. Check browser console for errors (F12)
3. Verify CORS is configured correctly

### Metrics Not Updating?
1. Make some API requests to generate metrics
2. Refresh the dashboard
3. Check network tab for API calls

---

## 🎯 SUCCESS CRITERIA

✅ **Window opens successfully**  
✅ **Observability dashboard loads**  
✅ **Metrics display correctly**  
✅ **Charts render and update**  
✅ **API endpoints respond**  
✅ **Real-time updates work**  
✅ **No console errors**  

---

## 📝 NOTES

- **Production Build:** Using optimized production assets
- **Hot Reload:** Disabled (production mode)
- **Backend:** Running separately on port 3001
- **Window Size:** 1400x900 (configurable in `src-tauri/tauri.conf.json`)

---

**Status:** ✅ **READY FOR TESTING**  
**Universal Legend Status:** 🌟 **OPERATIONAL IN WINDOWED MODE**
