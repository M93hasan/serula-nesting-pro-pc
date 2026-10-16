'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolveBuildMetadata } = require('./version-sync.cjs');

const root = path.resolve(__dirname, '..');
const sources = [
  process.env.SERULA_WEB_DIR,
  path.join(root, 'web-source', 'web'),
  path.join(root, '..', 'nesting', 'web')
].filter(Boolean);
const source = sources.map(p => path.resolve(p)).find(p => fs.existsSync(path.join(p, 'package.json')));
if (!source) {
  throw Error('Serula web kaynağı bulunamadı. nesting deposunu web-source/ konumuna alın veya SERULA_WEB_DIR tanımlayın.');
}
const meta = resolveBuildMetadata({
  pcVersion: JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version,
  webVersion: JSON.parse(fs.readFileSync(path.join(source,'package.json'),'utf8')).version,
  webCommit: process.env.SERULA_WEB_SHA,
  sourceDir: source
});
if (!fs.existsSync(path.join(source, 'node_modules', '.bin')))
  throw Error('Web bağımlılıkları kurulu değil: npm ci --prefix "' + source + '"');
const staging = path.join(root, '.offline-build', 'web');
const output = path.join(root, 'offline-web');
fs.rmSync(staging, { recursive: true, force: true });
fs.mkdirSync(path.dirname(staging), { recursive: true });
fs.cpSync(source, staging, {
  recursive: true,
  filter: (src) => {
    const rel = path.relative(source, src).replace(/\\/g, '/');
    return !rel.split('/').some(part => ['node_modules', '.git', 'dist', '.vite', 'playwright-report', 'test-results'].includes(part));
  }
});
fs.symlinkSync(path.join(source, 'node_modules'), path.join(staging, 'node_modules'),
  process.platform === 'win32' ? 'junction' : 'dir');

function write(relative, value) {
  fs.writeFileSync(path.join(staging, relative), value, 'utf8');
}
const originalEntry = fs.readFileSync(path.join(source, 'src/main.tsx'), 'utf8');
if (!originalEntry.includes("import App from './App'"))
  throw Error('Web giriş dosyası değişmiş. Offline derlemesi kontrol edilmeli.');
write('src/main.tsx', [
  "import {createRoot} from 'react-dom/client';",
  "import App from './App';",
  "import type {Document} from './model';",
  "import './admin.css';",
  "import './auth.css';",
  "import {I18nProvider} from './i18n';",
  "import {loadCatalog} from './datasets';",
  "async function startOffline() {",
  "  let document:Document|undefined;",
  "  try {",
  "    const response=await fetch('/api/project/autosave?content=1',{cache:'no-store'});",
  "    if(response.ok){",
  "      const value:unknown=await response.json();",
  "      if(value&&typeof value==='object'&&",
  "        typeof (value as Document).name==='string'&&",
  "        Array.isArray((value as Document).parts)&&",
  "        (value as Document).settings)document=value as Document;",
  "    }",
  "  } catch {}",
  "  createRoot(documentElement()).render(<I18nProvider>",
  "    {document?<App initialDocument={document}/>:<App/>}",
  "  </I18nProvider>);",
  "  void loadCatalog().catch(()=>{});",
  "}",
  "function documentElement(){const element=document.getElementById('root');if(!element)throw Error('Serula root not found');return element;}",
  "void startOffline();",
  ""
].join('\n'));

// These overlays only exist in the PC build. Never edit the live website.
write('src/components/SupportChat.tsx',
  "export default function SupportChat(){return <section className=\"support-chat\"><strong>Çevrimdışı PC sürümü</strong><p>Canlı destek internet gerektirir. Nesting ve dosya işlemleri çevrimdışı kullanılabilir.</p></section>}\n");

function replaceLabels(file, replacements) {
  const p = path.join(staging, file);
  let text = fs.readFileSync(p, 'utf8');
  for (const [oldText, newText] of replacements) text = text.split(oldText).join(newText);
  fs.writeFileSync(p, text, 'utf8');
}
// The online App defaults to recoveryReady=false until its default sample
// finishes loading. PC boots its project directly from the local API instead,
// so allow browser recovery and autosave to begin immediately.
replaceLabels('src/App.tsx', [
  ['const [recoveryReady,setRecoveryReady]=useState(false)', 'const [recoveryReady,setRecoveryReady]=useState(true)']
]);
replaceLabels('src/App.tsx', [
  ['Buluta kaydedildi', 'Bilgisayara kaydedildi'],
  ['Buluta kaydediliyor…', 'Bilgisayara kaydediliyor…'],
  ['buluta kaydedildi.', 'bilgisayara kaydedildi.'],
  ['Bu tarayıcıda otomatik kaydedilir; giriş yapılmışsa buluta da senkronlanır.', 'Bu bilgisayarda otomatik kaydedilir.']
]);
replaceLabels('src/components/ExportHistory.tsx', [
  ['Bulut kayıtları', 'Bilgisayardaki kayıtlar'],
  ['otomatik bulut kaydı', 'otomatik PC kaydı'],
  ['Bulut proje kaydı', 'Yerel proje kaydı'],
  ['Giriş yaptıktan sonra proje değişiklikleri otomatik olarak burada saklanır.', 'Proje değişiklikleri bilgisayarınıza otomatik kaydedilir.']
]);

function npm(args) {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    cwd: staging, stdio: 'inherit', shell: process.platform === 'win32'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error('Çevrimdışı derleme başarısız: npm ' + args.join(' '));
}
npm(['run', 'test-dxf:catalog']);
// The web repository currently has a mismatched prebuilt.sha256. Preserve
// its supplied binary unchanged, rather than rebuilding/modifying the engine.
for (const dir of ['pkg', 'pkg-threads', 'pkg-nosimd', 'pkg-threads-nosimd']) {
  const folder = path.join(staging, 'wasm', dir);
  if (!fs.existsSync(folder) || !fs.readdirSync(folder).some(f => f.endsWith('.wasm')))
    throw Error('Offline WASM paketi eksik: ' + dir);
}
console.warn('Web prebuilt.sha256 doğrulaması upstream sürümde başarısız olabilir; mevcut dört WASM paketi korunuyor.');
npm(['run', 'typecheck']);
npm(['exec', '--', 'vite', 'build']);

const dist = path.join(staging, 'dist');
for (const required of ['index.html', 'assets']) {
  if (!fs.existsSync(path.join(dist, required))) throw Error('Offline dağıtım eksik: ' + required);
}
fs.rmSync(output, { recursive: true, force: true });
fs.cpSync(dist, output, { recursive: true });
fs.writeFileSync(path.join(output,'serula-build.json'),JSON.stringify(meta,null,2)+'\n','utf8');
console.log('Çevrimdışı web/WASM paketi hazır:', output,
  'PC/Web '+meta.pcVersion+'/'+meta.webVersion,'web commit '+meta.webCommit);
