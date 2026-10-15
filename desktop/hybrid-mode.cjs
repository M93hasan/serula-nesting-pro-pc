'use strict';
const https = require('node:https');

const ONLINE_URL = 'https://serula.site/';
const CHECK_INTERVAL_MS = 12000;
const CHECK_TIMEOUT_MS = 4500;

// Checking the actual service is more reliable than navigator.onLine, which
// can return true on Wi-Fi without usable internet connectivity.
function probeSerula(url = ONLINE_URL, timeoutMs = CHECK_TIMEOUT_MS) {
  return new Promise((resolve) => {
    let settled = false;
    const complete = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    const request = https.request(url, {
      method: 'GET',
      timeout: timeoutMs,
      headers: { 'User-Agent': 'Serula-Nesting-PC-Connectivity/1', Accept: 'text/html' }
    }, (response) => {
      let bytes = 0;
      let html = '';
      const type = String(response.headers['content-type'] || '');
      if (response.statusCode !== 200 || !type.includes('text/html')) {
        response.resume();
        return complete(false);
      }
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        // A captive portal can return HTTP 200; verify Serula's HTML content.
        if (bytes <= 160 * 1024) html += chunk;
        bytes += Buffer.byteLength(chunk);
        if (bytes > 180 * 1024) response.destroy();
      });
      response.on('end', () => complete(/<title[^>]*>[^<]*Serula/i.test(html)));
      response.on('error', () => complete(false));
    });
    request.on('timeout', () => request.destroy(new Error('timeout')));
    request.on('error', () => complete(false));
    request.end();
  });
}
function nextMode(current, online, hasOfflineChanges = false) {
  if (!online) return 'offline';
  if (current === 'offline' && hasOfflineChanges) return 'offline';
  return 'online';
}
module.exports = { ONLINE_URL, CHECK_INTERVAL_MS, CHECK_TIMEOUT_MS, probeSerula, nextMode };
