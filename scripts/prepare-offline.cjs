'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

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
  "import './admin.css';",
  "import './auth.css';",
  "import {I18nProvider} from './i18n';",
  "import {loadCatalog} from './datasets';",
  "createRoot(document.getElementById('root')!).render(<I18nProvider><App/></I18nProvider>);",
  "void loadCatalog().catch(()=>{});",
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
npm(['run', 'wasm:verify']);
npm(['run', 'typecheck']);
npm(['exec', '--', 'vite', 'build']);

const dist = path.join(staging, 'dist');
for (const required of ['index.html', 'assets']) {
  if (!fs.existsSync(path.join(dist, required))) throw Error('Offline dağıtım eksik: ' + required);
}
fs.rmSync(output, { recursive: true, force: true });
fs.cpSync(dist, output, { recursive: true });
console.log('Çevrimdışı web/WASM paketi hazır:', output);
