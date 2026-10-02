const { ipcRenderer } = require('electron');

let queuedJob = null;
let importInProgress = false;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function findDxfInput() {
  for (let i = 0; i < 80; i += 1) {
    const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
    const input = inputs.find(el => String(el.getAttribute('accept') || '').toLowerCase().includes('.dxf'));
    if (input) return input;
    await sleep(250);
  }
  return null;
}

function decodeBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importCorelJob(job) {
  if (!job || !job.inputPath || importInProgress) return;
  importInProgress = true;
  try {
    const payload = await ipcRenderer.invoke('corel:read-input', job.inputPath);
    if (!payload || !payload.base64) throw new Error('Corel DXF could not be read.');

    const input = await findDxfInput();
    if (!input) throw new Error('Serula DXF input control was not found.');

    const file = new File(
      [decodeBase64(payload.base64)],
      payload.name || 'corel-selection.dxf',
      { type: 'application/dxf' }
    );
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    ipcRenderer.send('corel:imported', job);
  } catch (error) {
    ipcRenderer.send('corel:import-error', String(error && error.message ? error.message : error));
  } finally {
    importInProgress = false;
  }
}

ipcRenderer.on('corel:job', (_event, job) => {
  queuedJob = job;
  if (document.readyState === 'loading') return;
  void importCorelJob(queuedJob);
});

window.addEventListener('DOMContentLoaded', () => {
  if (queuedJob) void importCorelJob(queuedJob);
});
