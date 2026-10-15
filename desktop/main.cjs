'use strict';
const { app, BrowserWindow, shell, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createOfflineServer } = require('./offline-server.cjs');

let offlineServer;
let offlineOrigin;

function installAndStartBundledTransferBridge() {
  if (process.platform !== 'win32') return;
  const resourceDir = app.isPackaged
    ? path.join(process.resourcesPath, 'serula-bridge')
    : path.join(__dirname, 'bridge');
  const installer = path.join(resourceDir, 'SetupBundledBridge.ps1');
  if (!fs.existsSync(installer)) return;
  const child = spawn('powershell.exe', [
    '-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass',
    '-WindowStyle', 'Hidden', '-File', installer
  ], { cwd: resourceDir, detached: true, windowsHide: true, stdio: 'ignore' });
  child.on('error', error => console.error('Serula Bridge startup failed:', error));
  child.unref();
}
function isLocalAppUrl(raw) {
  try { return new URL(raw).origin === offlineOrigin; } catch { return false; }
}
function openSafeExternal(raw) {
  try {
    const url = new URL(raw);
    if (['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol)) void shell.openExternal(url.toString());
  } catch {}
}
async function createWindow() {
  const win = new BrowserWindow({
    title: 'Serula Nesting Pro PC — Çevrimdışı',
    width: 1500,
    height: 960,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0f1720',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isLocalAppUrl(url)) openSafeExternal(url);
    // Do not open extra windows with access to the local offline session.
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!isLocalAppUrl(url)) {
      event.preventDefault();
      openSafeExternal(url);
    }
  });
  await win.loadURL(offlineOrigin + '/');
}
app.whenReady().then(async () => {
  const assetsDir = app.isPackaged
    ? path.join(process.resourcesPath, 'serula-offline-web')
    : path.join(__dirname, '..', 'offline-web');
  const dataDir = path.join(app.getPath('userData'), 'offline-data');
  offlineServer = createOfflineServer({ assetsDir, dataDir });
  offlineOrigin = await offlineServer.listen();
  const ses = session.defaultSession;
  await ses.cookies.set({
    url: offlineOrigin,
    name: 'serula_pc_session',
    value: offlineServer.token,
    path: '/',
    httpOnly: true,
    sameSite: 'strict'
  });
  // Program resources and requests remain on 127.0.0.1, even with no network.
  // Explicitly clicked external hyperlinks may open in the user's browser.
  ses.webRequest.onBeforeRequest((details, callback) => {
    try {
      const url = new URL(details.url);
      if ((url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== offlineOrigin)
        return callback({ cancel: true });
    } catch {}
    callback({});
  });
  ses.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'fullscreen');
  });
  // The legacy web-to-Windows bridge needs online ticket verification. Avoid
  // automatic PowerShell installation in the offline-only PC mode.
  if (process.env.SERULA_INSTALL_LEGACY_BRIDGE === '1') installAndStartBundledTransferBridge();
  await createWindow();
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
}).catch(error => {
  console.error('Serula offline startup error:', error);
  app.quit();
});
app.on('before-quit', () => {
  if (offlineServer) void offlineServer.close().catch(() => {});
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
