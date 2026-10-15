'use strict';
const { app, BrowserWindow, Menu, dialog, shell, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { createOfflineServer } = require('./offline-server.cjs');
const { ONLINE_URL, CHECK_INTERVAL_MS, probeSerula, nextMode } = require('./hybrid-mode.cjs');
const choiceCss = fs.readFileSync(path.join(__dirname, 'selection-colors.css'), 'utf8');

let localServer, localOrigin, active = null, onlineWin, localWin;
let switching = false, polling = false, quitting = false;
let failures = 0, successes = 0, prompted = false, timer;

function onlineURL(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && (url.hostname === 'serula.site' || url.hostname.endsWith('.serula.site'));
  } catch { return false; }
}
function authURL(raw) {
  try { const u = new URL(raw); return u.protocol === 'https:' && (u.hostname === 'accounts.google.com' || u.hostname.endsWith('.google.com')); }
  catch { return false; }
}
function localURL(raw) {
  try { return new URL(raw).origin === localOrigin; } catch { return false; }
}
function openExternal(raw) {
  try { const u = new URL(raw); if (['https:', 'http:', 'mailto:', 'tel:'].includes(u.protocol)) void shell.openExternal(u.toString()); }
  catch {}
}
function label(mode) { return 'Serula Nesting Pro PC — ' + (mode === 'online' ? 'Çevrimiçi' : 'Çevrimdışı'); }
function windowFor(mode) { return mode === 'online' ? onlineWin : mode === 'offline' ? localWin : null; }

// This function executes in serula.site's page, not in the Node/Electron context.
function readOnlineRecovery() {
  return new Promise(resolve => {
    try {
      const request = indexedDB.open('sparrow-project', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('recovery');
      request.onerror = () => resolve(null);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction('recovery', 'readonly');
        const item = tx.objectStore('recovery').get('latest');
        item.onsuccess = () => {
          let json = null;
          try { json = item.result ? JSON.stringify(item.result) : null; } catch {}
          resolve(json);
        };
        item.onerror = () => resolve(null);
        tx.oncomplete = () => db.close();
        tx.onabort = () => { db.close(); resolve(null); };
      };
    } catch { resolve(null); }
  });
}
async function captureOnlineRecovery() {
  if (!onlineWin || onlineWin.isDestroyed() || !onlineURL(onlineWin.webContents.getURL())) return;
  try {
    const json = await Promise.race([
      onlineWin.webContents.executeJavaScript('(' + readOnlineRecovery.toString() + ')()'),
      new Promise(resolve => setTimeout(() => resolve(null), 2000))
    ]);
    if (typeof json === 'string') localServer.importOnlineRecovery(json);
  } catch (e) { console.warn('Online recovery snapshot failed:', String(e)); }
}
function createWindow(mode) {
  let win = windowFor(mode);
  if (win && !win.isDestroyed()) return win;
  win = new BrowserWindow({
    show: false, title: label(mode), width: 1500, height: 960,
    minWidth: 1100, minHeight: 700, backgroundColor: '#0f1720', autoHideMenuBar: true,
    webPreferences: {
      ...(mode === 'offline' ? { partition: 'persist:serula-pc-local' } : {}),
      contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false
    }
  });
  win.on('page-title-updated', e => { e.preventDefault(); win.setTitle(label(mode)); });
  // The web site's late global blue-button rule overrides selected controls.
  // Apply this purely visual CSS in both hybrid windows, without touching the
  // protected nesting website repo or changing nesting logic.
  win.webContents.on('did-finish-load', () => {
    void win.webContents.insertCSS(choiceCss, { cssOrigin: 'user' }).catch(error => {
      console.warn('Serula selected button CSS:', error);
    });
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (mode === 'online' && (onlineURL(url) || authURL(url))) {
      return { action: 'allow', overrideBrowserWindowOptions: {
        autoHideMenuBar: true,
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
      } };
    }
    openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (mode === 'online' ? !onlineURL(url) : !localURL(url)) {
      e.preventDefault(); openExternal(url);
    }
  });
  if (mode === 'online') {
    onlineWin = win;
    win.webContents.on('did-fail-load', (_event, code, reason, _url, mainFrame) => {
      if (mainFrame && code !== -3 && active === 'online' && !switching) {
        console.warn('Online load failed:', reason);
        void switchMode('offline');
      }
    });
  } else localWin = win;
  win.on('close', () => { if (!quitting) { quitting = true; app.quit(); } });
  return win;
}
async function switchMode(target, { manual = false } = {}) {
  if (switching || active === target) return false;
  switching = true;
  try {
    const previous = active;
    if (target === 'online') {
      if (!await probeSerula()) return false;
      if (previous === 'offline' && localServer.hasPendingLocalChanges()) {
        if (!manual) return false;
        const result = await dialog.showMessageBox(windowFor('offline'), {
          type: 'warning', title: 'Yerel proje kaydınız var',
          message: 'Çevrimdışı değişiklikler otomatik olarak buluta gönderilmez.',
          detail: 'Yerel proje ve DXF geçmişi bilgisayarınızda korunur. Çevrimiçi ekranda başka bir proje olabilir; gerektiğinde Çevrimdışı moda geri dönebilirsiniz.',
          buttons: ['Çevrimdışı kal', 'Çevrimiçi aç'],
          defaultId: 0, cancelId: 0
        });
        if (result.response !== 1) return false;
        localServer.acceptLocalChanges(); // Acknowledged; NOT cloud synchronized.
      }
    }
    if (target === 'offline' && previous === 'online') {
      // The online web app already saves recovery into IndexedDB. Back it up
      // before hiding the online window; do not discard unsynced local files.
      if (!localServer.hasPendingLocalChanges()) await captureOnlineRecovery();
    }
    const win = createWindow(target);
    const firstLoad = !win.webContents.getURL();
    if (firstLoad || (target === 'offline' && previous === 'online')) {
      try { await win.loadURL(target === 'online' ? ONLINE_URL : localOrigin + '/'); }
      catch (e) {
        if (target === 'online') { console.warn('Online failed; retaining offline:', String(e)); return false; }
        throw e;
      }
    }
    const old = windowFor(previous);
    if (old && !old.isDestroyed()) old.hide();
    win.setTitle(label(target));
    win.show(); win.focus();
    active = target;
    rebuildMenu();
    return true;
  } finally { switching = false; }
}
async function checkConnectivity() {
  if (polling || switching || quitting) return;
  polling = true;
  try {
    if (await probeSerula()) { successes++; failures = 0; }
    else { failures++; successes = 0; prompted = false; }
    // Two consecutive failures/recoveries avoid flapping on weak Wi-Fi.
    if (active === 'online' && failures >= 2) await switchMode('offline');
    if (active === 'offline' && successes >= 2) {
      if (nextMode('offline', true, localServer.hasPendingLocalChanges()) === 'online') {
        await switchMode('online');
      } else if (!prompted) {
        prompted = true;
        const result = await dialog.showMessageBox(windowFor('offline'), {
          type: 'info', title: 'İnternet bağlantısı geri geldi',
          message: 'Çevrimiçi mod hazır, ancak çevrimdışı düzenlemeleriniz var.',
          detail: 'Buluta sessizce yazmamak için otomatik geçiş duraklatıldı. Projeniz bilgisayarda güvende.',
          buttons: ['Çevrimdışı devam et', 'Çevrimiçi geç'],
          defaultId: 0, cancelId: 0
        });
        if (result.response === 1) await switchMode('online', { manual: true });
      }
    }
  } catch (e) { console.warn('Connectivity check:', String(e)); }
  finally { polling = false; }
}
function rebuildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Serula', submenu: [
      { label: 'Çevrimiçi aç', accelerator: 'CmdOrCtrl+Shift+O',
        click: () => void switchMode('online', { manual: true }) },
      { label: 'Çevrimdışı aç', accelerator: 'CmdOrCtrl+Shift+L',
        click: () => void switchMode('offline', { manual: true }) },
      { label: 'Bağlantıyı kontrol et', click: () => void checkConnectivity() },
      { type: 'separator' }, { label: 'Yenile', role: 'reload' },
      { label: 'Çıkış', role: 'quit' }
    ] },
    { label: 'Yardım', submenu: [
      { label: 'Serula sitesi', click: () => openExternal(ONLINE_URL) },
      { label: 'Yerel kayıt klasörü', click: () =>
        void shell.openPath(path.join(app.getPath('userData'), 'offline-data')) }
    ] }
  ]));
}
app.whenReady().then(async () => {
  const assetsDir = app.isPackaged
    ? path.join(process.resourcesPath, 'serula-offline-web')
    : path.join(__dirname, '..', 'offline-web');
  localServer = createOfflineServer({ assetsDir, dataDir: path.join(app.getPath('userData'), 'offline-data') });
  localOrigin = await localServer.listen();
  const localSession = session.fromPartition('persist:serula-pc-local');
  await localSession.cookies.set({ url: localOrigin, name: 'serula_pc_session',
    value: localServer.token, path: '/', httpOnly: true, sameSite: 'strict' });
  // Separate sessions: offline can never fetch external URLs, while online
  // keeps the prior defaultSession's Serula login and Google auth support.
  localSession.webRequest.onBeforeRequest((details, callback) => {
    try {
      const u = new URL(details.url);
      if (['http:', 'https:'].includes(u.protocol) && u.origin !== localOrigin)
        return callback({ cancel: true });
    } catch {}
    callback({});
  });
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) =>
    callback(onlineURL(contents.getURL()) &&
      new Set(['local-network-access', 'media', 'display-capture', 'notifications', 'fullscreen']).has(permission))
  );
  localSession.setPermissionRequestHandler((_c, permission, callback) =>
    callback(permission === 'fullscreen')
  );
  rebuildMenu();
  const reachable = await probeSerula();
  const startup = nextMode('offline', reachable, localServer.hasPendingLocalChanges());
  await switchMode(startup);
  if (!active) await switchMode('offline');
  timer = setInterval(() => void checkConnectivity(), CHECK_INTERVAL_MS);
  app.on('activate', () => {
    const win = windowFor(active);
    if (win && !win.isDestroyed()) { win.show(); win.focus(); }
  });
}).catch(e => {
  console.error('Serula hybrid startup failed:', e);
  dialog.showErrorBox('Serula başlatılamadı', String(e));
  app.quit();
});
app.on('before-quit', () => {
  quitting = true;
  if (timer) clearInterval(timer);
  if (localServer) void localServer.close().catch(() => {});
});
app.on('window-all-closed', () => app.quit());
