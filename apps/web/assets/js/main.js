const api = {
  async listWorkspaces(ownerId) {
    const q = ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : '';
    const r = await fetch(`/api/workspaces${q}`);
    return r.json();
  },
  async listPrompts(workspaceId) {
    const r = await fetch(`/api/workspaces/${workspaceId}/prompts`);
    return r.json();
  },
  async createThread(workspaceId, systemPromptId) {
    const r = await fetch('/api/threads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId, systemPromptId }) });
    return r.json();
  },
  async getThread(threadId) {
    const r = await fetch(`/api/threads/${threadId}`);
    return r.json();
  },
  async postMessage(threadId, role, content) {
    const r = await fetch(`/api/threads/${threadId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, content }) });
    return r.json();
  }
};

const state = { threadId: null, workspaceId: null };

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function renderMessage(container, msg) {
  const wrap = el('div', `message ${msg.role === 'assistant' ? 'ai' : ''}`);
  const avatar = el('div', 'avatar');
  const bubble = el('div', 'bubble');
  bubble.textContent = msg.content;
  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  container.appendChild(wrap);
}

async function refreshPrompts() {
  const workspaceId = state.workspaceId;
  const promptSel = document.getElementById('promptSelect');
  promptSel.innerHTML = '';
  if (!workspaceId) return;
  const prompts = await api.listPrompts(workspaceId);
  for (const p of prompts) {
    const opt = el('option');
    opt.value = p.id;
    opt.textContent = p.name + (p.isDefault ? ' (default)' : '');
    promptSel.appendChild(opt);
  }
}

async function refreshThreadMessages() {
  if (!state.threadId) return;
  const data = await api.getThread(state.threadId);
  const msgContainer = document.getElementById('messages');
  msgContainer.innerHTML = '';
  for (const m of data.messages) renderMessage(msgContainer, m);
  msgContainer.scrollTop = msgContainer.scrollHeight;
}

async function init() {
  const wsSelect = document.getElementById('workspaceSelect');
  const workspaces = await api.listWorkspaces();
  wsSelect.innerHTML = '';
  for (const w of workspaces) {
    const opt = el('option');
    opt.value = w.id;
    opt.textContent = `${w.name} (credits: ${w.credits})`;
    wsSelect.appendChild(opt);
  }
  if (workspaces.length) {
    state.workspaceId = workspaces[0].id;
    await refreshPrompts();
    const thread = await api.createThread(state.workspaceId, document.getElementById('promptSelect').value || null);
    state.threadId = thread.id;
    await refreshThreadMessages();
  }

  wsSelect.addEventListener('change', async () => {
    state.workspaceId = wsSelect.value;
    await refreshPrompts();
    const thread = await api.createThread(state.workspaceId, document.getElementById('promptSelect').value || null);
    state.threadId = thread.id;
    await refreshThreadMessages();
  });

  document.getElementById('chatForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (!text || !state.threadId) return;

    await api.postMessage(state.threadId, 'user', text);

    input.value = '';
    renderMessage(document.getElementById('messages'), { role: 'user', content: text });

    // small delay, then fetch new messages (assistant)
    setTimeout(refreshThreadMessages, 600);
  });
}

init().catch(console.error);