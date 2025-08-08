async function listThreads(workspaceId) {
  const q = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
  const r = await fetch(`/api/threads${q}`);
  return r.json();
}

async function getThread(id) {
  const r = await fetch(`/api/threads/${id}`);
  return r.json();
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function renderThread(container, t) {
  const row = el('div', 'p-3 rounded border border-neutral-700 bg-neutral-900');
  const title = el('div', 'font-semibold', t.title || t.id);
  row.appendChild(title);
  const open = el('button', 'mt-2 px-2 py-1 bg-neutral-800 rounded text-xs', 'Aç');
  open.onclick = async () => {
    const data = await getThread(t.id);
    const msgs = data.messages.map(m => `${m.role}: ${m.content}`).join('\n');
    alert(msgs || 'Mesaj yok');
  };
  row.appendChild(open);
  container.appendChild(row);
}

async function init() {
  const container = document.getElementById('threadList');
  const input = document.getElementById('filterWorkspaceId');
  const btn = document.getElementById('loadThreads');

  btn.addEventListener('click', async () => {
    const list = await listThreads(input.value.trim() || undefined);
    container.innerHTML = '';
    list.forEach(t => renderThread(container, t));
  });
}

init().catch(console.error);