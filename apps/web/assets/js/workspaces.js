async function ensureDemoUser() {
  const r = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Demo User', email: 'demo@example.com' }) });
  return r.json();
}

async function listWorkspaces(ownerId) {
  const q = ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : '';
  const r = await fetch(`/api/workspaces${q}`);
  return r.json();
}

async function createWorkspace(name, description, ownerId) {
  const r = await fetch('/api/workspaces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description, ownerId }) });
  return r.json();
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

async function refreshList(ownerId) {
  const list = await listWorkspaces(ownerId);
  const container = document.getElementById('wsList');
  container.innerHTML = '';
  for (const w of list) {
    const card = el('div', 'p-3 rounded border border-neutral-700 bg-neutral-900');
    card.appendChild(el('div', 'font-semibold', w.name));
    card.appendChild(el('div', 'text-sm text-neutral-400', w.description || ''));
    card.appendChild(el('div', 'text-xs text-neutral-500', `Credits: ${w.credits}`));
    const actions = el('div', 'mt-2 flex gap-2');
    const addCredits = el('button', 'px-2 py-1 bg-neutral-800 rounded text-xs', '+100 kredi');
    addCredits.onclick = async () => {
      await fetch(`/api/workspaces/${w.id}/credits/add`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: 100 }) });
      await refreshList(ownerId);
    };
    actions.appendChild(addCredits);
    card.appendChild(actions);
    container.appendChild(card);
  }
}

async function init() {
  const user = await ensureDemoUser();
  document.getElementById('wsCreate').addEventListener('click', async () => {
    const name = document.getElementById('wsName').value.trim();
    const desc = document.getElementById('wsDesc').value.trim();
    if (!name) return;
    await createWorkspace(name, desc, user.id);
    document.getElementById('wsName').value = '';
    document.getElementById('wsDesc').value = '';
    await refreshList(user.id);
  });

  await refreshList(user.id);
}

init().catch(console.error);