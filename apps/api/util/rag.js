import path from 'path';
import fs from 'fs/promises';
import { ensureDir, listFilesRecursively, readTextFileSafe, writeJson, readJson } from './fs.js';

const STORAGE_DIR = '/workspace/storage';
const DATA_DIR = '/workspace/data';

const SUPPORTED_TEXT_EXTENSIONS = new Set(['.txt', '.md', '.csv', '.json']);

function normalizeWhitespace(text) {
  return (text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/ +/g, ' ')
    .trim();
}

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9ğüşöçıİıçşöüğ\s]+/gi, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function chunkText(text, chunkSize = 1200, overlap = 200) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(text.length, i + chunkSize);
    const chunk = text.slice(i, end);
    chunks.push(chunk);
    if (end === text.length) break;
    i = end - overlap;
    if (i < 0) i = 0;
  }
  return chunks;
}

async function extractTextFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (SUPPORTED_TEXT_EXTENSIONS.has(ext)) {
    return normalizeWhitespace(await readTextFileSafe(filePath));
  }
  // Placeholder for PDFs and others: store filename as content stub
  return `Unsupported file for text extraction yet: ${path.basename(filePath)}`;
}

export async function ingestWorkspaceFiles(workspaceId) {
  const wsDir = path.join(STORAGE_DIR, workspaceId, 'uploads');
  const txtDir = path.join(STORAGE_DIR, workspaceId, 'text');
  await ensureDir(txtDir);
  const files = await listFilesRecursively(wsDir);
  for (const f of files) {
    const baseName = path.basename(f);
    const outPath = path.join(txtDir, baseName + '.txt');
    try {
      const text = await extractTextFromFile(f);
      await fs.writeFile(outPath, text, 'utf-8');
    } catch (e) {
      // ignore individual failures
    }
  }
}

export async function buildIndexForWorkspace(workspaceId) {
  const txtDir = path.join(STORAGE_DIR, workspaceId, 'text');
  const textFiles = await listFilesRecursively(txtDir);
  const documents = [];

  for (const tf of textFiles) {
    const text = await readTextFileSafe(tf);
    if (!text) continue;
    const chunks = chunkText(text);
    chunks.forEach((chunk, idx) => {
      documents.push({ id: `${path.basename(tf)}::${idx}`, text: chunk, source: tf, idx });
    });
  }

  // Build IDF
  const docCount = documents.length || 1;
  const df = new Map();
  const docTokens = documents.map(d => {
    const toks = new Set(tokenize(d.text));
    toks.forEach(t => df.set(t, (df.get(t) || 0) + 1));
    return toks;
  });

  const idf = {};
  for (const [term, f] of df.entries()) {
    idf[term] = Math.log((docCount + 1) / (f + 1)) + 1;
  }

  // Build vectors
  const vectors = [];
  for (const doc of documents) {
    const counts = new Map();
    const toks = tokenize(doc.text);
    toks.forEach(t => counts.set(t, (counts.get(t) || 0) + 1));
    const vec = {};
    let normSq = 0;
    for (const [term, c] of counts.entries()) {
      const weight = (c / toks.length) * (idf[term] || 0);
      if (weight > 0) {
        vec[term] = weight;
        normSq += weight * weight;
      }
    }
    vectors.push({ id: doc.id, source: doc.source, preview: doc.text.slice(0, 300), vec, norm: Math.sqrt(normSq) });
  }

  const index = { idf, vectors };
  const outPath = path.join(DATA_DIR, 'indexes', `${workspaceId}.json`);
  await ensureDir(path.dirname(outPath));
  await writeJson(outPath, index);
}

export async function queryWorkspaceIndex(workspaceId, question, topK = 5) {
  const indexPath = path.join(DATA_DIR, 'indexes', `${workspaceId}.json`);
  const index = await readJson(indexPath, { idf: {}, vectors: [] });
  const { idf, vectors } = index;
  if (!vectors.length) return [];

  const toks = tokenize(question);
  const counts = new Map();
  toks.forEach(t => counts.set(t, (counts.get(t) || 0) + 1));

  const qvec = {};
  let qnormSq = 0;
  for (const [term, c] of counts.entries()) {
    const weight = (c / toks.length) * (idf[term] || 0);
    if (weight > 0) {
      qvec[term] = weight;
      qnormSq += weight * weight;
    }
  }
  const qnorm = Math.sqrt(qnormSq) || 1;

  const scores = vectors.map(d => {
    let dot = 0;
    for (const t in qvec) {
      const qw = qvec[t];
      const dw = d.vec[t] || 0;
      dot += qw * dw;
    }
    const denom = (d.norm || 1) * qnorm;
    const score = denom ? dot / denom : 0;
    return { id: d.id, source: d.source, preview: d.preview, score };
  });

  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, topK);
}