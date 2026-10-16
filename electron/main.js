const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { utilityProcess } = require('electron');
const path = require('path');
const fs = require('fs');

const PORT = Number(process.env.GOOOOOOOK_PORT || 32123);
const APP_URL = `http://127.0.0.1:${PORT}`;
let serverProcess = null;
let hostWindow = null;
let controllerWindow = null;
let lastStatus = { state: 'starting', message: '正在啟動 gooooooook host…', url: APP_URL };

function setStatus(state, message) {
  lastStatus = { state, message, url: APP_URL };
  if (hostWindow && !hostWindow.isDestroyed()) hostWindow.webContents.send('host-status', lastStatus);
}

function startServer() {
  if (serverProcess) return;
  const dataDir = app.getPath('userData');
  fs.mkdirSync(path.join(dataDir, 'lyrics'), { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'state'), { recursive: true });
  serverProcess = utilityProcess.fork(path.join(__dirname, '..', 'server.js'), [], {
    env: {
      ...process.env,
      GOOOOOOOK_DATA_DIR: dataDir,
      HOST: '127.0.0.1',
      PORT: String(PORT),
      ELECTRON_RUN_AS_NODE: '1'
    },
    stdio: 'pipe'
  });
  serverProcess.on('message', message => {
    if (message === 'ready') setStatus('running', 'Host 已啟動。手機與電視請連接同一 Wi-Fi。');
  });
  serverProcess.stdout.on('data', chunk => {
    const text = chunk.toString();
    if (text.includes('host ready')) setStatus('running', 'Host 已啟動。手機與電視請連接同一 Wi-Fi。');
  });
  serverProcess.stderr.on('data', chunk => {
    const text = chunk.toString().trim();
    if (text) console.error('[goooooook server]', text);
  });
  serverProcess.on('exit', code => {
    serverProcess = null;
    if (lastStatus.state !== 'stopping') setStatus('error', `Host 已停止（exit ${code}）。請重新開啟應用程式。`);
  });
}

function stopServer() {
  if (!serverProcess) return Promise.resolve();
  setStatus('stopping', '正在停止 host…');
  const process = serverProcess;
  return new Promise(resolve => {
    const timer = setTimeout(() => { try { process.kill(); } catch {} resolve(); }, 3000);
    process.once('exit', () => { clearTimeout(timer); resolve(); });
    try { process.kill(); } catch { clearTimeout(timer); resolve(); }
  });
}

function createHostWindow() {
  hostWindow = new BrowserWindow({
    width: 760,
    height: 560,
    backgroundColor: '#0f0f13',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  hostWindow.loadFile(path.join(__dirname, 'host.html'));
  hostWindow.on('closed', () => { hostWindow = null; });
}

function openController() {
  if (controllerWindow && !controllerWindow.isDestroyed()) return controllerWindow.focus();
  controllerWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    backgroundColor: '#0f0f13',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  controllerWindow.loadURL(APP_URL);
  controllerWindow.on('closed', () => { controllerWindow = null; });
}

app.whenReady().then(() => {
  createHostWindow();
  startServer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createHostWindow();
});

app.on('before-quit', async event => {
  if (serverProcess) {
    event.preventDefault();
    await stopServer();
    app.quit();
  }
});

ipcMain.handle('host:getStatus', () => lastStatus);
ipcMain.handle('host:openController', () => { openController(); return lastStatus; });
ipcMain.handle('host:openDataFolder', async () => { await shell.openPath(app.getPath('userData')); return lastStatus; });
ipcMain.handle('host:quit', async () => { app.quit(); return lastStatus; });
