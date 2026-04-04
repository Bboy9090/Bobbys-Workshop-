/**
 * Optional Electron shell for Bobby's Workshop.
 * Primary supported desktop target is Tauri (see README).
 * Usage: npm run build && npm run electron:dev
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
    },
  });

  const distIndex = path.join(__dirname, '..', 'dist', 'index.html');
  win.loadFile(distIndex);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
