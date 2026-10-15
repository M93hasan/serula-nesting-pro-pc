'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { nextMode } = require('../desktop/hybrid-mode.cjs');
const { createOfflineServer } = require('../desktop/offline-server.cjs');

test('internet selects online; offline work prevents destructive automatic return', () => {
  assert.equal(nextMode('offline', true, false), 'online');
  assert.equal(nextMode('online', false, false), 'offline');
  assert.equal(nextMode('offline', true, true), 'offline');
  assert.equal(nextMode('online', true, true), 'online');
});

test('online project handoff preserves previous offline autosave and tracks local edits', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'serula-hybrid-'));
  const assets = path.join(root, 'assets'), data = path.join(root, 'data');
  fs.mkdirSync(assets);
  fs.writeFileSync(path.join(assets, 'index.html'), '<!doctype html><title>Serula</title>');
  const server = createOfflineServer({ assetsDir: assets, dataDir: data });
  const base = await server.listen();
  const headers = { cookie: 'serula_pc_session=' + server.token, 'content-type': 'application/json' };
  try {
    const first = JSON.stringify({ name: 'Eski yerel proje', parts: [], settings: {} });
    assert.equal((await fetch(base + '/api/project/autosave', {
      method: 'PUT', headers, body: JSON.stringify({ projectName: 'Eski yerel proje', projectJson: first })
    })).status, 200);
    assert.equal(server.hasPendingLocalChanges(), true);
    const rev = server.getLocalRevision();
    // User-authorized return to online retains a local copy without upload.
    server.acceptLocalChanges();
    assert.equal(server.hasPendingLocalChanges(), false);
    const online = JSON.stringify({ name: 'Online çalışmam', parts: [], settings: {} });
    assert.equal(server.importOnlineRecovery(online), true);
    assert.equal(server.getLocalRevision(), rev);
    assert.equal(server.hasPendingLocalChanges(), false);
    assert.equal(fs.readFileSync(path.join(data, 'autosave.json'), 'utf8'), online);
    assert.equal(fs.readFileSync(path.join(data, 'last-online-recovery.json'), 'utf8'), online);
    const backups = fs.readdirSync(path.join(data, 'backups'));
    assert.equal(backups.length, 1);
    assert.equal(fs.readFileSync(path.join(data, 'backups', backups[0]), 'utf8'), first);
    const newDoc = JSON.stringify({ name: 'Offline devam', parts: [], settings: {} });
    await fetch(base + '/api/project/autosave', {
      method: 'PUT', headers,
      body: JSON.stringify({ projectName: 'Offline devam', projectJson: newDoc })
    });
    assert.equal(server.hasPendingLocalChanges(), true);
    assert.equal(server.importOnlineRecovery('{"invalid":true}'), false);
    assert.equal(fs.readFileSync(path.join(data, 'autosave.json'), 'utf8'), newDoc);
  } finally {
    await server.close();
  }
  const restored = createOfflineServer({ assetsDir: assets, dataDir: data });
  assert.equal(restored.hasPendingLocalChanges(), true);
  assert.equal(restored.getLocalRevision(), 2);
  fs.rmSync(root, { recursive: true, force: true });
});
