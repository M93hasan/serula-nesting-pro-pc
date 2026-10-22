'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {resolveBuildMetadata}=require('../scripts/version-sync.cjs');
const sha='bfc86360c68d65bb8e61b2025cf317a567c6a7e6';

test('records independent PC/web versions and exact web revision',()=>{
  const meta=resolveBuildMetadata({pcVersion:'0.1.16',webVersion:'0.1.11',webCommit:sha});
  assert.equal(meta.pcVersion,'0.1.16');
  assert.equal(meta.webVersion,'0.1.11');
  assert.equal(meta.webCommit,sha);
  assert.match(meta.packagedAt,/^\d{4}-/);
});
test('rejects invalid PC or web version strings',()=>{
  assert.throws(()=>resolveBuildMetadata({pcVersion:'latest',webVersion:'0.1.11',webCommit:sha}),/PC version/);
  assert.throws(()=>resolveBuildMetadata({pcVersion:'0.1.16',webVersion:'main',webCommit:sha}),/web version/);
});
test('rejects unknown web revision to prevent ambiguous offline releases',()=>{
  assert.throws(()=>resolveBuildMetadata({pcVersion:'0.1.16',webVersion:'0.1.11',webCommit:'main'}),/SHA/);
});
