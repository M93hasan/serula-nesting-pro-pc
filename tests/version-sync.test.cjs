'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {resolveBuildMetadata}=require('../scripts/version-sync.cjs');
const sha='bfc86360c68d65bb8e61b2025cf317a567c6a7e6';
test('records exact web revision in a matching PC installer',()=>{
  const meta=resolveBuildMetadata({pcVersion:'0.1.14',webVersion:'0.1.14',webCommit:sha});
  assert.equal(meta.webCommit,sha);
  assert.equal(meta.pcVersion,meta.webVersion);
  assert.match(meta.packagedAt,/^\d{4}-/);
});
test('rejects mismatched web and PC versions',()=>{
  assert.throws(()=>resolveBuildMetadata({
    pcVersion:'0.1.13',webVersion:'0.1.14',webCommit:sha
  }),/uyu\u015fmuyor/);
});
test('rejects unknown web revision to prevent ambiguous offline releases',()=>{
  assert.throws(()=>resolveBuildMetadata({pcVersion:'0.1.14',webVersion:'0.1.14',
    webCommit:'main'}),/SHA/);
});
