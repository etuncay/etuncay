import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import mime from 'mime-types';
import { nanoid } from 'nanoid';

import { ensureDir, readJson, writeJson, listFilesRecursively, readTextFileSafe } from './util/fs.js';
import { buildIndexForWorkspace, queryWorkspaceIndex, ingestWorkspaceFiles } from './util/rag.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const DATA_DIR = '/workspace/data';
const STORAGE_DIR = '/workspace/storage';
const WEB_DIR = '/workspace/apps/web';

await ensureDir(DATA_DIR);
await ensureDir(STORAGE_DIR);
await ensureDir(WEB_DIR);

const DB_FILE = path.join(DATA_DIR, 'db.json');

async function loadDb() {
  const defaultDb = {
    users: [],
    workspaces: [],
    prompts: [],
    threads: [],
    messages: [],
    files: [],
    providers: []
  };
  const db = await readJson(DB_FILE, defaultDb);
  return db;
}

async function saveDb(db) {
  await writeJson(DB_FILE, db);
}

function requireField(obj, field) {
  if (!obj || obj[field] === undefined || obj[field] === null || obj[field] === '') {
    const err = new Error(`Missing field: ${field}`);
    err.status = 400;
    throw err;
  }
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Users (very basic, no auth)
app.post('/api/users', async (req, res, next) => {
  try {
    const { name, email } = req.body;
    requireField(req.body, 'name');
    requireField(req.body, 'email');

    const db = await loadDb();
    const existing = db.users.find(u => u.email === email);
    if (existing) return res.json(existing);

    const user = { id: nanoid(), name, email, createdAt: new Date().toISOString() };
    db.users.push(user);
    await saveDb(db);
    res.json(user);
  } catch (err) { next(err); }
});

// Workspaces
app.post('/api/workspaces', async (req, res, next) => {
  try {
    const { name, description, ownerId } = req.body;
    requireField(req.body, 'name');
    requireField(req.body, 'ownerId');

    const db = await loadDb();
    const workspace = {
      id: nanoid(),
      name,
      description: description || '',
      ownerId,
      status: 'active',
      visibility: 'private',
      credits: 1000,
      createdAt: new Date().toISOString()
    };
    db.workspaces.push(workspace);
    await saveDb(db);

    const wsDir = path.join(STORAGE_DIR, workspace.id);
    await ensureDir(wsDir);

    res.json(workspace);
  } catch (err) { next(err); }
});

app.get('/api/workspaces', async (req, res, next) => {
  try {
    const { ownerId } = req.query;
    const db = await loadDb();
    const list = ownerId ? db.workspaces.filter(w => w.ownerId === ownerId) : db.workspaces;
    res.json(list);
  } catch (err) { next(err); }
});

app.post('/api/workspaces/:id/credits/add', async (req, res, next) => {
  try {
    const { amount } = req.body;
    const db = await loadDb();
    const ws = db.workspaces.find(w => w.id === req.params.id);
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    ws.credits += Number(amount || 0);
    await saveDb(db);
    res.json(ws);
  } catch (err) { next(err); }
});

// Prompts
app.get('/api/workspaces/:id/prompts', async (req, res, next) => {
  try {
    const db = await loadDb();
    const list = db.prompts.filter(p => p.workspaceId === req.params.id);
    res.json(list);
  } catch (err) { next(err); }
});

app.post('/api/workspaces/:id/prompts', async (req, res, next) => {
  try {
    const { name, content, isDefault } = req.body;
    requireField(req.body, 'name');
    requireField(req.body, 'content');

    const db = await loadDb();
    const workspace = db.workspaces.find(w => w.id === req.params.id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    if (isDefault) {
      db.prompts.forEach(p => {
        if (p.workspaceId === workspace.id) p.isDefault = false;
      });
    }

    const prompt = { id: nanoid(), workspaceId: workspace.id, name, content, isDefault: Boolean(isDefault), createdAt: new Date().toISOString() };
    db.prompts.push(prompt);
    await saveDb(db);
    res.json(prompt);
  } catch (err) { next(err); }
});

// Threads & messages
app.post('/api/threads', async (req, res, next) => {
  try {
    const { workspaceId, title, systemPromptId } = req.body;
    requireField(req.body, 'workspaceId');

    const db = await loadDb();
    const workspace = db.workspaces.find(w => w.id === workspaceId);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const thread = { id: nanoid(), workspaceId, title: title || 'New Thread', systemPromptId: systemPromptId || null, createdAt: new Date().toISOString() };
    db.threads.push(thread);
    await saveDb(db);
    res.json(thread);
  } catch (err) { next(err); }
});

app.get('/api/threads', async (req, res, next) => {
  try {
    const { workspaceId } = req.query;
    const db = await loadDb();
    let list = db.threads;
    if (workspaceId) list = list.filter(t => t.workspaceId === workspaceId);
    res.json(list);
  } catch (err) { next(err); }
});

app.get('/api/threads/:id', async (req, res, next) => {
  try {
    const db = await loadDb();
    const thread = db.threads.find(t => t.id === req.params.id);
    if (!thread) return res.status(404).json({ error: 'Thread not found' });
    const messages = db.messages.filter(m => m.threadId === thread.id);
    res.json({ ...thread, messages });
  } catch (err) { next(err); }
});

app.post('/api/threads/:id/messages', async (req, res, next) => {
  try {
    const { role, content } = req.body;
    requireField(req.body, 'role');
    requireField(req.body, 'content');

    const db = await loadDb();
    const thread = db.threads.find(t => t.id === req.params.id);
    if (!thread) return res.status(404).json({ error: 'Thread not found' });

    const message = { id: nanoid(), threadId: thread.id, role, content, createdAt: new Date().toISOString() };
    db.messages.push(message);

    // If user message, perform retrieval and simulate assistant reply
    if (role === 'user') {
      const workspace = db.workspaces.find(w => w.id === thread.workspaceId);
      if (workspace) {
        if (workspace.credits <= 0) {
          await saveDb(db);
          return res.status(402).json({ error: 'Insufficient credits' });
        }
        workspace.credits -= 1; // simple per-question debit
      }

      const top = await queryWorkspaceIndex(thread.workspaceId, content, 5);
      const stitchedContext = top.map((d, i) => `[#${i + 1}] ${d.preview}`).join('\n');
      const assistantContent = `Context:\n${stitchedContext}\n\nAnswer (simulated): Bu, bağlamsal geri getirim (RAG) ile derlenen örnek bir yanıttır. Gerçek LLM entegrasyonlarını workspace sağlayıcı ayarlarından ekleyebilirsiniz.`;
      const assistantMsg = { id: nanoid(), threadId: thread.id, role: 'assistant', content: assistantContent, createdAt: new Date().toISOString() };
      db.messages.push(assistantMsg);
    }

    await saveDb(db);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Providers (store credentials per workspace)
app.post('/api/workspaces/:id/providers', async (req, res, next) => {
  try {
    const { type, config } = req.body; // type: openai|anthropic|ollama|lmstudio|azureOpenAI
    requireField(req.body, 'type');
    const db = await loadDb();
    const workspace = db.workspaces.find(w => w.id === req.params.id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const provider = { id: nanoid(), workspaceId: workspace.id, type, config: config || {}, createdAt: new Date().toISOString() };
    db.providers.push(provider);
    await saveDb(db);
    res.json(provider);
  } catch (err) { next(err); }
});

// File upload
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    try {
      const workspaceId = req.body.workspaceId || req.query.workspaceId;
      if (!workspaceId) return cb(new Error('workspaceId required'));
      const dir = path.join(STORAGE_DIR, workspaceId, 'uploads');
      await ensureDir(dir);
      cb(null, dir);
    } catch (e) {
      cb(e);
    }
  },
  filename: function (req, file, cb) {
    const ext = mime.extension(file.mimetype) || path.extname(file.originalname) || '';
    const id = nanoid();
    const base = path.basename(file.originalname, path.extname(file.originalname));
    cb(null, `${base}-${id}${ext ? '.' + ext : ''}`);
  }
});

const upload = multer({ storage });

app.post('/api/upload', upload.array('files'), async (req, res, next) => {
  try {
    const workspaceId = req.body.workspaceId;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId required' });

    const db = await loadDb();
    const workspace = db.workspaces.find(w => w.id === workspaceId);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const saved = [];
    for (const file of req.files || []) {
      const rec = {
        id: nanoid(),
        workspaceId,
        path: file.path,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        createdAt: new Date().toISOString()
      };
      db.files.push(rec);
      saved.push(rec);
    }
    await saveDb(db);

    // Trigger ingestion in-process for simplicity
    await ingestWorkspaceFiles(workspaceId);
    await buildIndexForWorkspace(workspaceId);

    res.json({ files: saved });
  } catch (err) { next(err); }
});

app.post('/api/ingest/:workspaceId', async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    await ingestWorkspaceFiles(workspaceId);
    await buildIndexForWorkspace(workspaceId);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.post('/api/query', async (req, res, next) => {
  try {
    const { workspaceId, question, topK } = req.body;
    requireField(req.body, 'workspaceId');
    requireField(req.body, 'question');
    const top = await queryWorkspaceIndex(workspaceId, question, topK || 5);
    res.json({ results: top });
  } catch (err) { next(err); }
});

// Serve static frontend
app.use('/', express.static(WEB_DIR));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});