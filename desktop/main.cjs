const { app, BrowserWindow, shell, session } = require('electron');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const SERULA_URL = process.env.SERULA_URL || 'https://serula.site/';

function installAndStartBundledTransferBridge() {
  if (process.platform !== 'win32') return;
  const resourceDir = app.isPackaged
    ? path.join(process.resourcesPath, 'serula-bridge')
    : path.join(__dirname, 'bridge');
  const installer = path.join(resourceDir, 'SetupBundledBridge.ps1');
  if (!fs.existsSync(installer)) {
    console.warn('Serula Windows transfer bridge setup is missing:', installer);
    return;
  }
  // Install from packaged files, not from an untrusted remote download.
  // Windows may show its normal one-time elevation dialog for localhost URLACL.
  const child = spawn('powershell.exe', [
    '-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass',
    '-WindowStyle', 'Hidden', '-File', installer
  ], { cwd: resourceDir, detached: true, windowsHide: true, stdio: 'ignore' });
  child.on('error', error => console.error('Serula Bridge startup failed:', error));
  child.unref();
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function isSerulaUrl(url) {
  const host = hostnameOf(url);
  return host === 'serula.site' || host.endsWith('.serula.site');
}

function isAllowedAuthPopup(url) {
  const host = hostnameOf(url);
  return host === 'accounts.google.com' || host.endsWith('.google.com');
}

async function createWindow() {
  const win = new BrowserWindow({
    title: 'Serula Nesting Pro PC',
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
    if (isSerulaUrl(url) || isAllowedAuthPopup(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
          }
        }
      };
    }
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!isSerulaUrl(url)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  await win.loadURL(SERULA_URL);
}

app.whenReady().then(async () => {
  installAndStartBundledTransferBridge();
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'local-network-access') {
      callback(isSerulaUrl(webContents.getURL()));
      return;
    }
    const allowed = new Set([
      'media',
      'display-capture',
      'notifications',
      'fullscreen'
    ]);
    callback(allowed.has(permission));
  });

  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
