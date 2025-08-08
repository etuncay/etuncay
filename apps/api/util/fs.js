import fs from 'fs/promises';
import path from 'path';

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function readJson(filePath, fallback) {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    if (fallback !== undefined) return fallback;
    throw e;
  }
}

export async function writeJson(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function listFilesRecursively(dirPath) {
  const results = [];
  async function walk(current) {
    try {
      const items = await fs.readdir(current, { withFileTypes: true });
      for (const item of items) {
        const full = path.join(current, item.name);
        if (item.isDirectory()) await walk(full);
        else results.push(full);
      }
    } catch (e) {
      // ignore missing dirs
    }
  }
  await walk(dirPath);
  return results;
}

export async function readTextFileSafe(filePath) {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (e) {
    return '';
  }
}