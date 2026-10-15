'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createOfflineServer } = require('../desktop/offline-server.cjs');

test('offline app serves local assets, protects API and persists autosave/export history', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'serula-offline-'));
  const assetsDir = path.join(temp, 'assets');
  const dataDir = path.join(temp, 'data');
  fs.mkdirSync(assetsDir);
  fs.writeFileSync(path.join(assetsDir, 'index.html'), '<!doctype html><title>Serula Offline</title>');
  fs.writeFileSync(path.join(assetsDir, 'test.wasm'), Buffer.from([0, 97, 115, 109]));
  let app = createOfflineServer({ assetsDir, dataDir });
  const origin = await app.listen();
  const cookies = { cookie: 'serula_pc_session=' + app.token };
  const request = (target, opts = {}) => fetch(origin + target, {
    ...opts,
    headers: { ...cookies, ...(opts.headers || {}) }
  });
  try {
    const page = await fetch(origin);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Serula Offline/);
    assert.equal(page.headers.get('cross-origin-embedder-policy'), 'require-corp');
    assert.equal(page.headers.get('cross-origin-opener-policy'), 'same-origin');
    const wasm = await request('/test.wasm');
    assert.equal(wasm.headers.get('content-type'), 'application/wasm');
    assert.equal((await wasm.arrayBuffer()).byteLength, 4);
    assert.equal((await fetch(origin + '/api/exports')).status, 403);
    assert.equal((await request('/api/exports', { headers: { origin: 'https://evil.example' } })).status, 403);

    const saved = await request('/api/project/autosave', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectName: 'Proje A', projectJson: '{"parts":[]}' })
    });
    assert.equal(saved.status, 200);
    assert.equal((await request('/api/project/autosave?content=1')).status, 200);
    assert.equal(await (await request('/api/project/autosave?content=1')).text(), '{"parts":[]}');
    assert.equal((await (await request('/api/project/autosave')).json()).item.projectName, 'Proje A');

    const exported = await request('/api/export/authorize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectName: 'Proje A', sourceFileName: 'input.dxf', fileName: 'out.dxf',
        dxf: '0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF', projectJson: '{"schemaVersion":1}' })
    });
    assert.equal(exported.status, 200);
    const id = (await exported.json()).id;
    const items = (await (await request('/api/exports')).json()).items;
    assert.equal(items.length, 1);
    assert.equal(items[0].fileName, 'out.dxf');
    assert.match(await (await request('/api/exports/' + id)).text(), /SECTION/);
    assert.equal(await (await request('/api/exports/' + id + '?kind=project')).text(), '{"schemaVersion":1}');
    assert.equal((await request('/api/test-dxf')).status, 200);
    assert.deepEqual(await (await request('/api/transfer/access')).json(), { corel: false, rdworks: false });
    assert.equal((await request('/api/transfer/ticket', { method: 'POST' })).status, 503);
    assert.equal((await request('/api/exports/' + id, { method: 'DELETE' })).status, 200);
    assert.deepEqual((await (await request('/api/exports')).json()).items, []);
    // Deleting all history must not reset the incremental export ID or the saved project.
    const nextExport = await request('/api/export/authorize', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectName: 'Proje B', sourceFileName: 'other.dxf',
        fileName: 'second.dxf', dxf: '0\\nEOF', projectJson: '{"schemaVersion":1}' })
    });
    assert.equal(nextExport.status, 200);
    const nextId = (await nextExport.json()).id;
    assert.ok(nextId > id);
    assert.equal((await fetch(origin + '/api/exports',{method:'DELETE'})).status,403);
    const clear = await request('/api/exports',{method:'DELETE'});
    assert.equal(clear.status, 200);
    assert.equal((await clear.json()).deleted,1);
    assert.deepEqual((await (await request('/api/exports')).json()).items,[]);
    assert.equal((await request('/api/exports/'+nextId)).status,404);
    assert.equal((await request('/api/project/autosave?content=1')).status,200);
    assert.equal((await request('/api/exports',{method:'DELETE'})).status,200);
  } finally {
    await app.close();
  }
  // Local data remains usable across application restarts.
  app = createOfflineServer({ assetsDir, dataDir });
  const secondOrigin = await app.listen();
  try {
    const res = await fetch(secondOrigin + '/api/project/autosave?content=1', {
      headers: { cookie: 'serula_pc_session=' + app.token }
    });
    assert.equal(await res.text(), '{"parts":[]}');
  } finally {
    await app.close();
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
