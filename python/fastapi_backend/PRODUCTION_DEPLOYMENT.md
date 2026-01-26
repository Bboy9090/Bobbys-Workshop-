# Production Deployment Guide
**Bobby's Secret Rooms FastAPI Backend**

---

## 📋 Pre-Deployment Checklist

### ✅ Environment Setup

1. **Install Python 3.9+**
   ```bash
   python --version  # Should be 3.9 or higher
   ```

2. **Create Virtual Environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   # OR
   venv\Scripts\activate  # Windows
   ```

3. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Install Optional Dependencies (for full functionality)**
   ```bash
   # Ghost Codex (required for metadata operations)
   pip install Pillow exifread
   
   # Sonic Codex (optional, for audio transcription)
   pip install openai-whisper  # OR faster-whisper
   # System dependencies: ffmpeg, portaudio
   
   # Pandora Codex (optional, for iOS tools)
   # Requires system tools: libimobiledevice
   ```

---

## 🔧 Configuration

1. **Copy Environment Template**
   ```bash
   cp .env.example .env
   ```

2. **Update `.env` File**
   ```env
   ENVIRONMENT=production
   SECRET_ROOM_PASSCODE=your-secure-passcode-here
   CORS_ORIGINS=https://your-frontend-domain.com
   FASTAPI_LOG_DIR=/var/log/bobbys-workshop
   HOST=127.0.0.1
   PORT=8000
   ```

3. **Create Log Directory**
   ```bash
   mkdir -p /var/log/bobbys-workshop
   chmod 755 /var/log/bobbys-workshop
   ```

---

## 🚀 Deployment Options

### Option 1: Direct Uvicorn (Development/Simple)

```bash
uvicorn main:app --host 127.0.0.1 --port 8000 --workers 1
```

### Option 2: Gunicorn + Uvicorn Workers (Production)

```bash
# Install Gunicorn
pip install gunicorn

# Run with multiple workers
gunicorn main:app \
    --workers 4 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 127.0.0.1:8000 \
    --access-logfile /var/log/bobbys-workshop/access.log \
    --error-logfile /var/log/bobbys-workshop/error.log \
    --log-level info
```

### Option 3: Systemd Service (Linux)

Create `/etc/systemd/system/bobbys-workshop-fastapi.service`:

```ini
[Unit]
Description=Bobby's Workshop FastAPI Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/bobbys-workshop/fastapi_backend
Environment="PATH=/opt/bobbys-workshop/venv/bin"
EnvironmentFile=/opt/bobbys-workshop/fastapi_backend/.env
ExecStart=/opt/bobbys-workshop/venv/bin/gunicorn main:app \
    --workers 4 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 127.0.0.1:8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable bobbys-workshop-fastapi
sudo systemctl start bobbys-workshop-fastapi
sudo systemctl status bobbys-workshop-fastapi
```

### Option 4: Docker (Containerized)

Create `Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create directories
RUN mkdir -p logs jobs personas canary_tokens uploads shreaded

# Expose port
EXPOSE 8000

# Run
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build and run:
```bash
docker build -t bobbys-workshop-fastapi .
docker run -d \
    -p 8000:8000 \
    -e ENVIRONMENT=production \
    -e SECRET_ROOM_PASSCODE=your-passcode \
    -v $(pwd)/logs:/app/logs \
    -v $(pwd)/jobs:/app/jobs \
    bobbys-workshop-fastapi
```

---

## 🔒 Security Hardening

### 1. Firewall Configuration

```bash
# Allow only localhost access (recommended)
sudo ufw allow from 127.0.0.1 to any port 8000

# OR allow from specific IPs
sudo ufw allow from 192.168.1.0/24 to any port 8000
```

### 2. Reverse Proxy (Nginx)

Create `/etc/nginx/sites-available/bobbys-workshop`:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /api/v1/trapdoor/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Increase timeouts for long-running operations
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:8000;
        access_log off;
    }
}
```

Enable:
```bash
sudo ln -s /etc/nginx/sites-available/bobbys-workshop /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Rate Limiting

Install:
```bash
pip install slowapi
```

Add to `main.py`:
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Apply to endpoints
@app.post("/api/v1/trapdoor/sonic/upload")
@limiter.limit("10/minute")
async def sonic_upload(...):
    ...
```

---

## 📊 Monitoring

### Health Checks

```bash
# Basic health check
curl http://127.0.0.1:8000/health

# API status
curl -H "X-Secret-Room-Passcode: your-passcode" http://127.0.0.1:8000/api/v1/status
```

### Log Monitoring

```bash
# Watch logs in real-time
tail -f /var/log/bobbys-workshop/fastapi.log

# Check for errors
grep ERROR /var/log/bobbys-workshop/fastapi.log

# Check access logs
tail -f /var/log/bobbys-workshop/access.log
```

### Metrics (Optional)

Add Prometheus metrics:
```bash
pip install prometheus-fastapi-instrumentator
```

Add to `main.py`:
```python
from prometheus_fastapi_instrumentator import Instrumentator

Instrumentator().instrument(app).expose(app)
```

---

## 🧪 Testing

### Test Health Endpoint
```bash
curl http://127.0.0.1:8000/health
```

### Test API Endpoint
```bash
curl -H "X-Secret-Room-Passcode: your-passcode" \
     http://127.0.0.1:8000/api/v1/trapdoor/sonic
```

### Test File Upload
```bash
curl -X POST \
     -H "X-Secret-Room-Passcode: your-passcode" \
     -F "file=@test.mp3" \
     http://127.0.0.1:8000/api/v1/trapdoor/sonic/upload
```

---

## 🔄 Updates and Maintenance

### Update Application

1. **Pull Latest Code**
   ```bash
   git pull origin main
   ```

2. **Update Dependencies**
   ```bash
   pip install -r requirements.txt --upgrade
   ```

3. **Restart Service**
   ```bash
   # Systemd
   sudo systemctl restart bobbys-workshop-fastapi
   
   # Docker
   docker-compose restart
   ```

### Backup

Backup important directories:
```bash
tar -czf backup-$(date +%Y%m%d).tar.gz \
    jobs/ personas/ canary_tokens/ logs/
```

---

## 📝 Troubleshooting

### Service Won't Start

1. Check logs:
   ```bash
   journalctl -u bobbys-workshop-fastapi -n 50
   ```

2. Check port availability:
   ```bash
   netstat -tuln | grep 8000
   ```

3. Check permissions:
   ```bash
   ls -la logs/ jobs/ personas/
   ```

### Module Import Errors

1. Verify virtual environment is activated
2. Check `requirements.txt` installation:
   ```bash
   pip list | grep -E "Pillow|exifread|whisper"
   ```

### Permission Errors

1. Fix directory permissions:
   ```bash
   chmod 755 jobs/ personas/ canary_tokens/ uploads/ shreaded/
   chmod 644 logs/*.log
   ```

---

## ✅ Production Checklist

- [ ] Environment variables configured
- [ ] Secret passcode changed from default
- [ ] Log directory created and writable
- [ ] Firewall configured
- [ ] Reverse proxy configured (if using)
- [ ] SSL/TLS certificates installed (if using HTTPS)
- [ ] Service configured to start on boot
- [ ] Monitoring set up
- [ ] Backups configured
- [ ] Health checks tested
- [ ] All endpoints tested

---

**Status:** Production Ready ✅  
**Last Updated:** 2025-01-27
