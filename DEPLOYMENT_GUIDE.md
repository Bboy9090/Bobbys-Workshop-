# Deployment Guide for Phoenix Forge Diagnostic & Repair App

This guide provides deployment instructions for the Phoenix Forge diagnostic and repair application.

## Table of Contents

1. [Frontend Deployment (Firebase Hosting)](#frontend-deployment-firebase-hosting)
2. [Backend Deployment Options](#backend-deployment-options)
3. [Push Notifications Setup (FCM)](#push-notifications-setup-fcm)
4. [Environment Configuration](#environment-configuration)
5. [CI/CD Pipeline](#cicd-pipeline)

---

## Frontend Deployment (Firebase Hosting)

### Prerequisites
- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)
- Firebase project created

### Step 1: Initialize Firebase

```bash
# Login to Firebase
firebase login

# Initialize Firebase in your project
firebase init hosting
```

Select the following options:
- **Public directory**: `dist`
- **Configure as single-page app**: Yes
- **Set up automatic builds with GitHub**: Optional (recommended)

### Step 2: Create Firebase Configuration

Create `firebase.json` in the project root:

```json
{
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css|woff2)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=31536000"
          }
        ]
      }
    ]
  }
}
```

### Step 3: Build and Deploy

```bash
# Build the frontend
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

### Step 4: Custom Domain (Optional)

```bash
# Add custom domain
firebase hosting:sites:create your-site-name

# Update firebase.json with your domain
# Then redeploy
firebase deploy --only hosting
```

---

## Backend Deployment Options

### Option 1: Heroku Deployment

#### Prerequisites
- Heroku account
- Heroku CLI installed

#### Step 1: Create Heroku App

```bash
# Login to Heroku
heroku login

# Create new app
heroku create phoenix-forge-api

# Add Node.js buildpack
heroku buildpacks:set heroku/nodejs
```

#### Step 2: Create `Procfile`

Create `Procfile` in the `server` directory:

```
web: node index.js
```

#### Step 3: Configure Environment Variables

```bash
# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set PORT=3001
heroku config:set DEMO_MODE=0

# Add any additional environment variables
heroku config:set DATABASE_URL=your_database_url
```

#### Step 4: Deploy

```bash
# Initialize git in server directory if needed
cd server
git init
heroku git:remote -a phoenix-forge-api

# Deploy
git add .
git commit -m "Deploy backend"
git push heroku main
```

#### Step 5: Scale Dynos

```bash
# Scale web dyno
heroku ps:scale web=1

# Check logs
heroku logs --tail
```

### Option 2: AWS Deployment (EC2)

#### Prerequisites
- AWS account
- EC2 instance with Ubuntu
- Node.js 20+ installed on EC2

#### Step 1: SSH into EC2 Instance

```bash
ssh -i your-key.pem ubuntu@your-ec2-public-ip
```

#### Step 2: Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install ADB tools (for Android diagnostics)
sudo apt install -y android-tools-adb android-tools-fastboot

# Install libimobiledevice (for iOS diagnostics)
sudo apt install -y libimobiledevice-utils
```

#### Step 3: Deploy Application

```bash
# Clone repository
git clone https://github.com/your-repo/phoenix-forge.git
cd phoenix-forge/server

# Install dependencies
npm install --production

# Create .env file
cat > .env << EOF
NODE_ENV=production
PORT=3001
DEMO_MODE=0
EOF
```

#### Step 4: Configure PM2

```bash
# Start application with PM2
pm2 start index.js --name phoenix-forge-api

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

#### Step 5: Configure Nginx Reverse Proxy

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/phoenix-forge
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/phoenix-forge /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### Step 6: Setup SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured by default
```

### Option 3: Docker Deployment

#### Create `Dockerfile` in server directory:

```dockerfile
FROM node:20-alpine

# Install system dependencies for native modules
RUN apk add --no-cache python3 make g++

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app source
COPY . .

# Expose port
EXPOSE 3001

# Set environment to production
ENV NODE_ENV=production

# Start application
CMD ["node", "index.js"]
```

#### Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  backend:
    build: ./server
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DEMO_MODE=0
    restart: unless-stopped
    volumes:
      - ./server:/usr/src/app
      - /usr/src/app/node_modules
    devices:
      - /dev/bus/usb:/dev/bus/usb  # For USB device access

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - backend
    restart: unless-stopped
```

#### Deploy with Docker:

```bash
# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

## Push Notifications Setup (FCM)

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing
3. Add a web app to your project

### Step 2: Get Firebase Config

In Firebase Console, go to Project Settings > General > Your apps > Web app

Copy the Firebase configuration:

```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};
```

### Step 3: Add FCM to Frontend

Create `src/firebase-config.js`:

```javascript
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  // Your config here
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export const requestNotificationPermission = async () => {
  try {
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: 'your-vapid-key'
      });
      
      console.log('FCM Token:', token);
      return token;
    }
  } catch (error) {
    console.error('Error getting notification permission:', error);
  }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
```

### Step 4: Create Service Worker

Create `public/firebase-messaging-sw.js`:

```javascript
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  // Your config here
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192x192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
```

### Step 5: Send Notifications from Backend

Install Firebase Admin SDK:

```bash
cd server
npm install firebase-admin
```

Create `server/utils/fcm-notifications.js`:

```javascript
import admin from 'firebase-admin';

// Initialize Firebase Admin
const serviceAccount = require('../firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

export async function sendRepairStatusNotification(token, ticketId, status) {
  const message = {
    notification: {
      title: 'Repair Status Update',
      body: `Ticket ${ticketId} status: ${status}`
    },
    data: {
      ticketId,
      status,
      timestamp: new Date().toISOString()
    },
    token
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Notification sent:', response);
    return { success: true, response };
  } catch (error) {
    console.error('Error sending notification:', error);
    return { success: false, error: error.message };
  }
}
```

---

## Environment Configuration

### Frontend `.env` (for Vite)

Create `.env.production`:

```env
VITE_API_URL=https://your-api-domain.com
VITE_SOCKET_URL=https://your-api-domain.com
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

### Backend `.env`

Create `server/.env`:

```env
NODE_ENV=production
PORT=3001
DEMO_MODE=0

# Firebase Admin SDK (for FCM)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="your-private-key"

# Database (if using)
DATABASE_URL=your-database-url

# Logging
BW_LOG_DIR=/var/log/phoenix-forge
BW_LOG_FILE=/var/log/phoenix-forge/backend.log

# CORS Origins
CORS_ORIGINS=https://your-frontend-domain.com,https://your-api-domain.com
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy Phoenix Forge

on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
        env:
          VITE_API_URL: ${{ secrets.API_URL }}
          VITE_SOCKET_URL: ${{ secrets.SOCKET_URL }}
      
      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          projectId: your-firebase-project-id

  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Heroku
        uses: akhileshns/heroku-deploy@v3.12.12
        with:
          heroku_api_key: ${{ secrets.HEROKU_API_KEY }}
          heroku_app_name: phoenix-forge-api
          heroku_email: ${{ secrets.HEROKU_EMAIL }}
          appdir: server
```

### Required GitHub Secrets

Add these secrets to your repository (Settings > Secrets and variables > Actions):

- `API_URL`: Your backend API URL
- `SOCKET_URL`: Your Socket.IO server URL
- `FIREBASE_SERVICE_ACCOUNT`: Firebase service account JSON
- `HEROKU_API_KEY`: Your Heroku API key
- `HEROKU_EMAIL`: Your Heroku email

---

## Post-Deployment Checklist

- [ ] Frontend accessible at production URL
- [ ] Backend API responding correctly
- [ ] Socket.IO real-time updates working
- [ ] CORS configured correctly
- [ ] SSL certificates installed and valid
- [ ] Push notifications working
- [ ] Environment variables set correctly
- [ ] Database connected (if applicable)
- [ ] ADB/libimobiledevice tools installed on backend server
- [ ] USB device permissions configured
- [ ] Monitoring and logging enabled
- [ ] Backup strategy in place
- [ ] Domain DNS configured
- [ ] CDN configured (optional)

---

## Monitoring and Maintenance

### Health Check Endpoint

The backend provides a health check endpoint:

```
GET /api/v1/ready
```

Use this for monitoring services like UptimeRobot, Pingdom, or AWS CloudWatch.

### Logging

Backend logs are written to:
- Console output (for Docker/Heroku)
- File system at `$BW_LOG_DIR/backend.log` (for EC2)

### Backup Strategy

1. **Database backups**: Configure daily automated backups
2. **Code repository**: Keep Git history
3. **Environment variables**: Document all secrets in secure vault
4. **SSL certificates**: Automatic renewal with Let's Encrypt

---

## Support

For deployment issues or questions:
- Check the logs: `pm2 logs phoenix-forge-api` or `heroku logs --tail`
- Review the [Backend README](./server/README.md)
- Open an issue on GitHub

---

## License

MIT License - See [LICENSE](./LICENSE) for details.
