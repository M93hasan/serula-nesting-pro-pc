'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('PC hybrid applies selected-control styling in both windows', () => {
  const root = path.join(__dirname, '..');
  const main = fs.readFileSync(path.join(root, 'desktop', 'main.cjs'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'desktop', 'selection-colors.css'), 'utf8');
  for (const selector of [
    '.rotation-choice .row-actions button[aria-pressed="true"]',
    '.rotation-choice .row-actions button[aria-pressed="false"]',
    '.mirror-control .row-actions button[aria-pressed="true"]',
    '.result-mode button[aria-pressed="true"]',
    '.canvas-tools button[aria-pressed="true"]',
    '.auth-tabs button.active',
    '.admin-sidebar nav button.active'
  ]) {
    assert.ok(css.includes(selector), 'Missing selected control style: ' + selector);
  }
  assert.match(css, /#147fbd|#147fd4|#075da7/i);
  assert.match(css, /color:\s*#fff\s*!important/);
  assert.match(main, /win\.webContents\.on\('did-finish-load'/);
  assert.match(main, /insertCSS\(choiceCss,\s*\{\s*cssOrigin:\s*'user'\s*\}\)/);
  assert.equal(/(?:padding|min-height|font-size|width):/.test(css), false,
    'Selection colors must not alter button dimensions.');
});
