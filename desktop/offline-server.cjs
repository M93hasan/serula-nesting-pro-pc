'use strict';
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.dxf': 'application/dxf'
};
const MAX_BYTES = 50 * 1024 * 1024;
const MAX_EXPORTS = 50;

function atomicWrite(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.' + crypto.randomBytes(8).toString('hex') + '.tmp';
  try {
    fs.writeFileSync(temp, content, { flag: 'wx' });
    fs.renameSync(temp, file);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}
function respond(res, status, value, type = 'application/json; charset=utf-8') {
  const body = Buffer.isBuffer(value) ? value : type.startsWith('application/json') ? JSON.stringify(value) : String(value);
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}
function fail(res, status, error) { respond(res, status, { error }); }
async function readJson(req) {
  let count = 0;
  const chunks = [];
  for await (const chunk of req) {
    count += chunk.length;
    if (count > MAX_BYTES) {
      const error = new Error('Dosya 50 MB sınırını aşıyor.');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { const error = new Error('Geçersiz JSON verisi.'); error.status = 400; throw error; }
}

function createOfflineServer({ assetsDir, dataDir }) {
  const assets = fs.realpathSync(assetsDir);
  if (!fs.statSync(path.join(assets, 'index.html')).isFile()) throw Error('Offline index.html bulunamadı.');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'exports'), { recursive: true });
  const token = crypto.randomBytes(32).toString('hex');
  const manifestPath = path.join(dataDir, 'manifest.json');
  const autosavePath = path.join(dataDir, 'autosave.json');
  let manifest = { nextId: 1, items: [], autosave: null, localRevision: 0, acceptedRevision: 0 };
  if (fs.existsSync(manifestPath)) {
    const saved = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (Number.isSafeInteger(saved.nextId) && Array.isArray(saved.items))
      manifest = { nextId: saved.nextId, items: saved.items, autosave: saved.autosave || null,
        localRevision: Number.isSafeInteger(saved.localRevision) ? saved.localRevision : 0,
        acceptedRevision: Number.isSafeInteger(saved.acceptedRevision) ? saved.acceptedRevision : 0 };
  }
  function saveManifest() { atomicWrite(manifestPath, JSON.stringify(manifest)); }
  function exportFile(id, ext) { return path.join(dataDir, 'exports', String(id) + ext); }
  function markOfflineChange() { manifest.localRevision++; }
  function hasPendingLocalChanges() { return manifest.localRevision > manifest.acceptedRevision; }
  function acceptLocalChanges() { manifest.acceptedRevision = manifest.localRevision; saveManifest(); }
  function importOnlineRecovery(value) {
    if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > MAX_BYTES) return false;
    let doc;
    try { doc = JSON.parse(value); } catch { return false; }
    if (!doc || !Array.isArray(doc.parts) || typeof doc.name !== 'string') return false;
    // Always keep a separate online recovery copy. Never discard prior offline
    // autosaves, even if the user switches modes many times.
    atomicWrite(path.join(dataDir, 'last-online-recovery.json'), value);
    if (fs.existsSync(autosavePath)) {
      const previous = fs.readFileSync(autosavePath, 'utf8');
      if (previous === value) return true;
      const backup = path.join(dataDir, 'backups',
        'offline-' + new Date().toISOString().replace(/[:.]/g, '-') +
        '-' + crypto.randomBytes(4).toString('hex') + '.json');
      atomicWrite(backup, previous);
    }
    atomicWrite(autosavePath, value);
    manifest.autosave = {
      label: 'Serula Nesting En Temiz Hali',
      projectName: doc.name.slice(0, 150),
      byteSize: Buffer.byteLength(value, 'utf8'),
      updatedAt: new Date().toISOString()
    };
    // Imported data is not an offline edit. A previous local revision must
    // still be acknowledged by the user before a destructive mode transition.
    saveManifest();
    return true;
  }

  const server = http.createServer(async (req, res) => {
    // Workers, SharedArrayBuffer and threaded WASM need cross-origin isolation.
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
      const pathname = requestUrl.pathname;
      if (pathname.startsWith('/api/')) {
        const cookies = (req.headers.cookie || '').split(';').map(x => x.trim());
        if (!cookies.includes('serula_pc_session=' + token)) return fail(res, 403, 'Yetkisiz yerel istek.');
        const origin = req.headers.origin;
        const host = 'http://' + req.headers.host;
        if (origin && origin !== host) return fail(res, 403, 'Geçersiz istek kaynağı.');

        if (pathname === '/api/export/authorize' && req.method === 'POST') {
          const body = await readJson(req);
          if (typeof body.dxf !== 'string' || !body.dxf ||
              typeof body.projectJson !== 'string' || !body.projectJson)
            return fail(res, 400, 'DXF veya proje içeriği eksik.');
          const id = manifest.nextId;
          atomicWrite(exportFile(id, '.dxf'), body.dxf);
          atomicWrite(exportFile(id, '.json'), body.projectJson);
          const item = {
            id, projectName: String(body.projectName || '').slice(0, 150),
            sourceFileName: String(body.sourceFileName || '').slice(0, 150),
            fileName: String(body.fileName || 'serula.dxf').slice(0, 180),
            byteSize: Buffer.byteLength(body.dxf, 'utf8'),
            createdAt: new Date().toISOString()
          };
          manifest.items.unshift(item);
          manifest.nextId++;
          markOfflineChange();
          const dropped = manifest.items.splice(MAX_EXPORTS);
          saveManifest();
          for (const old of dropped) for (const ext of ['.dxf', '.json']) {
            try { fs.unlinkSync(exportFile(old.id, ext)); } catch {}
          }
          return respond(res, 200, { ok: true, offline: true, id });
        }
        if (pathname === '/api/project/autosave') {
          if (req.method === 'PUT') {
            const body = await readJson(req);
            if (typeof body.projectJson !== 'string' || !body.projectJson)
              return fail(res, 400, 'Proje içeriği eksik.');
            atomicWrite(autosavePath, body.projectJson);
            markOfflineChange();
            manifest.autosave = {
              label: 'Serula Nesting En Temiz Hali',
              projectName: String(body.projectName || '').slice(0, 150),
              byteSize: Buffer.byteLength(body.projectJson, 'utf8'),
              updatedAt: new Date().toISOString()
            };
            saveManifest();
            return respond(res, 200, { ok: true, offline: true });
          }
          if (req.method === 'GET') {
            if (requestUrl.searchParams.get('content') === '1') {
              if (!fs.existsSync(autosavePath)) return fail(res, 404, 'Yerel proje kaydı yok.');
              return respond(res, 200, fs.readFileSync(autosavePath), 'application/json; charset=utf-8');
            }
            return respond(res, 200, { item: manifest.autosave });
          }
        }
        if (pathname === '/api/exports' && req.method === 'GET')
          return respond(res, 200, { items: manifest.items });
        const match = /^\/api\/exports\/([1-9]\d*)$/.exec(pathname);
        if (match) {
          const id = Number(match[1]);
          const item = manifest.items.find(x => x.id === id);
          if (!item) return fail(res, 404, 'Geçmiş kaydı bulunamadı.');
          if (req.method === 'GET') {
            const project = requestUrl.searchParams.get('kind') === 'project';
            const file = exportFile(id, project ? '.json' : '.dxf');
            return respond(res, 200, fs.readFileSync(file), project ? 'application/json; charset=utf-8' : 'application/dxf');
          }
          if (req.method === 'DELETE') {
            manifest.items = manifest.items.filter(x => x.id !== id);
            markOfflineChange();
            saveManifest();
            for (const ext of ['.dxf', '.json']) {
              try { fs.unlinkSync(exportFile(id, ext)); } catch {}
            }
            return respond(res, 200, { ok: true });
          }
        }
        if (pathname === '/api/test-dxf' && req.method === 'GET')
          return respond(res, 200, { allowed: false });
        if (pathname === '/api/transfer/access' && req.method === 'GET')
          return respond(res, 200, { corel: false, rdworks: false });
        return fail(res, 503, 'Bu çevrimiçi özellik PC çevrimdışı modunda kullanılamaz.');
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405, 'İzin verilmeyen yöntem.');
      if (pathname.includes('\0')) return fail(res, 400, 'Geçersiz yol.');
      const candidate = path.resolve(assets, '.' + pathname);
      if (candidate !== assets && !candidate.startsWith(assets + path.sep))
        return fail(res, 403, 'Geçersiz dosya yolu.');
      let filename = candidate;
      if (fs.existsSync(filename) && fs.statSync(filename).isDirectory()) filename = path.join(filename, 'index.html');
      if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
        if (!path.extname(pathname)) filename = path.join(assets, 'index.html');
        else return fail(res, 404, 'Dosya bulunamadı.');
      }
      // A symlink in the bundle must not expose other files from the machine.
      const resolved = fs.realpathSync(filename);
      if (!resolved.startsWith(assets + path.sep)) return fail(res, 403, 'Geçersiz dosya yolu.');
      const stat = fs.statSync(resolved);
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(resolved).toLowerCase()] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': 'no-store'
      });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(resolved).pipe(res);
    } catch (error) {
      if (!res.headersSent) fail(res, error.status || 500, error.status ? error.message : 'Yerel işlem başarısız oldu.');
      else res.destroy();
      console.error('Serula offline request:', error);
    }
  });

  return {
    token,
    importOnlineRecovery,
    hasPendingLocalChanges,
    acceptLocalChanges,
    getLocalRevision() { return manifest.localRevision; },
    async listen() {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
      });
      return 'http://127.0.0.1:' + server.address().port;
    },
    close() { return new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve())); }
  };
}
module.exports = { createOfflineServer };
