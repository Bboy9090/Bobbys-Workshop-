/**
 * Electron Main Process
 * Replaces Tauri Rust code with JavaScript/Node.js
 */

const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

// No localhost! Always use bundled files (file:// protocol)
// Required for file:// protocol to work with modules
app.commandLine.appendSwitch('allow-file-access-from-files');
app.commandLine.appendSwitch('disable-site-isolation-trials'); // Allow ES modules in file://

// Keep a global reference of the window object
let mainWindow = null;
let backendProcess = null;

// Backend server configuration
const BACKEND_PORT = 3001;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

/**
 * Get the resource directory (where bundled files are located)
 */
function getResourceDir() {
  if (app.isPackaged) {
    // In production, resources are in the app's resources directory
    return path.join(process.resourcesPath, 'resources');
  } else {
    // In development, use the project root
    return path.join(__dirname, '..');
  }
}

/**
 * Find Node.js executable (bundled or system)
 */
function findNodeExecutable() {
  const resourceDir = getResourceDir();
  
  // Try bundled Node.js first
  if (app.isPackaged) {
    const bundledNode = path.join(resourceDir, 'nodejs', 'node.exe');
    if (fs.existsSync(bundledNode)) {
      return bundledNode;
    }
  }
  
  // Fall back to system Node.js
  const systemNode = process.execPath.includes('node.exe') 
    ? process.execPath 
    : 'node';
  
  return systemNode;
}

/**
 * Get log directory
 */
function getLogDirectory() {
  const platform = os.platform();
  
  if (platform === 'win32') {
    return path.join(os.homedir(), 'AppData', 'Local', 'BobbysWorkshop', 'logs');
  } else if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Logs', 'BobbysWorkshop');
  } else {
    return path.join(os.homedir(), '.local', 'share', 'bobbys-workshop', 'logs');
  }
}

/**
 * Start the backend server
 */
function startBackendServer() {
  if (backendProcess) {
    console.log('[Electron] Backend server already running');
    return;
  }
  
  console.log('[Electron] Starting backend API server...');
  
  const nodeExe = findNodeExecutable();
  const resourceDir = getResourceDir();
  const serverPath = path.join(resourceDir, 'server', 'index.js');
  const serverDir = path.join(resourceDir, 'server');
  const logDir = getLogDirectory();
  
  // Ensure log directory exists
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  if (!fs.existsSync(serverPath)) {
    console.error(`[Electron] Server file not found: ${serverPath}`);
    return;
  }
  
  // Spawn backend server with hidden window on Windows
  const spawnOptions = {
    cwd: serverDir,
    env: {
      ...process.env,
      PORT: BACKEND_PORT.toString(),
      BW_LOG_DIR: logDir
    },
    stdio: ['ignore', 'pipe', 'pipe']
  };
  
  // Hide console window on Windows
  if (process.platform === 'win32') {
    spawnOptions.windowsHide = true;
    spawnOptions.detached = false;
  }
  
  backendProcess = spawn(nodeExe, [serverPath], spawnOptions);
  
  backendProcess.stdout.on('data', (data) => {
    console.log(`[Backend] ${data.toString().trim()}`);
  });
  
  backendProcess.stderr.on('data', (data) => {
    console.error(`[Backend Error] ${data.toString().trim()}`);
  });
  
  backendProcess.on('exit', (code) => {
    console.log(`[Electron] Backend server exited with code ${code}`);
    backendProcess = null;
    
    // Attempt to restart if it crashed (but not on app quit)
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('[Electron] Attempting to restart backend server...');
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          startBackendServer();
        }
      }, 2000);
    }
  });
  
  console.log(`[Electron] Backend server started (PID: ${backendProcess.pid})`);
}

/**
 * Stop the backend server
 */
function stopBackendServer() {
  if (backendProcess) {
    console.log('[Electron] Stopping backend server...');
    backendProcess.kill();
    backendProcess = null;
  }
}

/**
 * Create the main application window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Bobbys Workshop",
    autoHideMenuBar: true, // Hide menu bar for cleaner look
    show: false, // Don't show until ready
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });
  
  // Show window when ready (prevents white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });
  
  // Load the app - ALWAYS from bundled files, NEVER from localhost
  const distPath = path.join(__dirname, '..', 'dist', 'index.html');
  
  if (fs.existsSync(distPath)) {
    // Load from bundled static files (file:// protocol, no localhost!)
    mainWindow.loadFile(distPath);
    console.log('[Electron] Loading from bundled files:', distPath);
  } else {
    // Fallback: Build the frontend first
    console.error('[Electron] Frontend not built! Run: npm run build');
    mainWindow.loadURL('data:text/html,<h1>Frontend not built!</h1><p>Run: npm run build</p>');
  }
  
  // Open DevTools in development (can be toggled later)
  // DevTools disabled by default - use Ctrl+Shift+I or Cmd+Option+I to open
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Wait for backend to be ready
 */
async function waitForBackend(maxAttempts = 30) {
  const http = require('http');
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`${BACKEND_URL}/api/health`, (res) => {
          if (res.statusCode === 200) {
            console.log('[Electron] Backend server is ready');
            resolve(true);
          } else {
            reject(new Error(`Status: ${res.statusCode}`));
          }
        });
        req.on('error', reject);
        req.setTimeout(1000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });
      return true;
    } catch (error) {
      // Backend not ready yet, wait and retry
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  console.warn('[Electron] Backend server did not become ready in time');
  return false;
}

// App event handlers
app.whenReady().then(async () => {
  // Start backend server
  startBackendServer();
  
  // Wait a bit for backend to start
  await waitForBackend();
  
  // Create window
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
    stopBackendServer();
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackendServer();
});

// IPC handlers for communication with renderer process
ipcMain.handle('get-backend-url', () => {
  return BACKEND_URL;
});

ipcMain.handle('get-resource-dir', () => {
  return getResourceDir();
});
