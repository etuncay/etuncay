const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const wsIdInput = document.getElementById('wsId');
const uploadList = document.getElementById('uploadList');

let files = [];

function renderFiles() {
  uploadList.innerHTML = '';
  files.forEach((f, i) => {
    const row = document.createElement('div');
    row.className = 'p-2 rounded border border-neutral-700 bg-neutral-900';
    row.textContent = `${f.name} (${f.size}B)`;
    uploadList.appendChild(row);
  });
}

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('border-emerald-600'); });
dropzone.addEventListener('dragleave', (e) => { dropzone.classList.remove('border-emerald-600'); });
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('border-emerald-600');
  files = [...files, ...Array.from(e.dataTransfer.files)];
  renderFiles();
});
fileInput.addEventListener('change', () => {
  files = [...files, ...Array.from(fileInput.files)];
  renderFiles();
});

uploadBtn.addEventListener('click', async () => {
  const workspaceId = wsIdInput.value.trim();
  if (!workspaceId || files.length === 0) return alert('Workspace Id ve dosyalar gerekli');

  const form = new FormData();
  form.append('workspaceId', workspaceId);
  files.forEach(f => form.append('files', f));

  const r = await fetch('/api/upload', { method: 'POST', body: form });
  const data = await r.json();
  if (data.error) { alert(data.error); return; }
  alert(`Yüklendi: ${data.files.length} dosya`);
  files = [];
  renderFiles();
});