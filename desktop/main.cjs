const { app, BrowserWindow, shell, session } = require('electron');

const SERULA_URL = process.env.SERULA_URL || 'https://serula.site/';

function isSerulaUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'serula.site' || parsed.hostname.endsWith('.serula.site');
  } catch {
    return false;
  }
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
    if (isSerulaUrl(url)) {
      return { action: 'allow' };
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
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
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
