const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');
require('dotenv').config();

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'debug';
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow;

log.info('AlphaForge starting...');
log.info('Version:', app.getVersion());
log.info('Platform:', process.platform);
log.info('Development mode:', isDev);

// Auto-updater configuration
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// Handle AI generation securely in main process
ipcMain.handle('generate-knob-params', async (event, description) => {
  try {
    log.info('AI generation requested:', description);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-api-key-here') {
      log.warn('GEMINI_API_KEY not configured');
      throw new Error('API Key not configured. Please set GEMINI_API_KEY in .env.local');
    }

    // Import here to avoid loading in renderer
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `Given the following description of a control knob, generate parameters for a 3D model.
Description: "${description}"

Respond with valid JSON only, no markdown, in this exact format:
{
  "diameter": <number between 15 and 80>,
  "height": <number between 10 and 50>,
  "topDiameter": <number between 10 and 60>,
  "grip": <number between 0 and 15>,
  "segments": <number, 6, 8, 12, 16, or 32>,
  "marker": <boolean>,
  "shaft": <"D-shaft" or "round">
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    log.info('AI response received');

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid AI response format');
    }

    const params = JSON.parse(jsonMatch[0]);
    log.info('Parsed parameters:', params);

    return params;
  } catch (error) {
    log.error('AI generation error:', error.message);
    throw error;
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#000000',
    icon: path.join(__dirname, 'build/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    title: 'AlphaForge - AI Knob Modeler',
    autoHideMenuBar: true
  });

  if (isDev) {
    // Development: load from Vite dev server
    log.info('Loading from dev server: http://localhost:3000');
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // Production: load from built files
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    log.info('Loading from file:', indexPath);
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    log.info('Main window closed');
    mainWindow = null;
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    log.error('Failed to load:', errorCode, errorDescription);
  });
}

app.whenReady().then(() => {
  log.info('App ready, creating window');
  createWindow();

  // Check for updates after window is created (only in production)
  if (!isDev) {
    setTimeout(() => {
      log.info('Checking for updates...');
      autoUpdater.checkForUpdates();
    }, 3000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      log.info('Activating - creating new window');
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  log.info('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  log.info('App quitting');
});

// Auto-updater event handlers
autoUpdater.on('checking-for-update', () => {
  log.info('Checking for update...');
  if (mainWindow) mainWindow.webContents.send('update-checking');
});

autoUpdater.on('update-available', (info) => {
  log.info('Update available:', info.version);
  if (mainWindow) mainWindow.webContents.send('update-available', info);
});

autoUpdater.on('update-not-available', (info) => {
  log.info('Update not available:', info.version);
  if (mainWindow) mainWindow.webContents.send('update-not-available', info);
});

autoUpdater.on('error', (err) => {
  log.error('Error in auto-updater:', err);
  if (mainWindow) mainWindow.webContents.send('update-error', err);
});

autoUpdater.on('download-progress', (progressObj) => {
  let logMessage = 'Download speed: ' + progressObj.bytesPerSecond;
  logMessage = logMessage + ' - Downloaded ' + progressObj.percent + '%';
  logMessage = logMessage + ' (' + progressObj.transferred + '/' + progressObj.total + ')';
  log.info(logMessage);
  if (mainWindow) mainWindow.webContents.send('update-download-progress', progressObj);
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded:', info.version);
  if (mainWindow) mainWindow.webContents.send('update-downloaded', info);
});

// IPC handlers for update actions
ipcMain.handle('check-for-updates', async () => {
  if (isDev) {
    log.info('Update check skipped in development mode');
    return { available: false, message: 'Updates disabled in development' };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return { available: true, updateInfo: result.updateInfo };
  } catch (error) {
    log.error('Update check failed:', error);
    return { available: false, error: error.message };
  }
});

ipcMain.handle('download-update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    log.error('Update download failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall(false, true);
});

// Global error handlers
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
