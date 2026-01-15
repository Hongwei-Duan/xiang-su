import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sqlite3 from 'sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const dbFile = path.join(root, 'data', 'pixel.db');

const blocks = [
  { id: 'neon-cyan', name: '霓虹青', tone: '霓虹', rarity: '稀有', rgb: '#0ea5e9' },
  { id: 'neon-pink', name: '霓虹粉', tone: '霓虹', rarity: '罕见', rgb: '#ef5da8' },
  { id: 'neon-purple', name: '霓虹紫', tone: '霓虹', rarity: '罕见', rgb: '#a855f7' },
  { id: 'soft-yellow', name: '柔黄', tone: '柔和', rarity: '普通', rgb: '#f5d565' },
  { id: 'soft-coral', name: '珊瑚', tone: '柔和', rarity: '稀有', rgb: '#f58b7c' },
  { id: 'soft-mint', name: '薄荷', tone: '柔和', rarity: '普通', rgb: '#7ad9c1' },
  { id: 'retro-green', name: '复古绿', tone: '复古', rarity: '普通', rgb: '#3ba56a' },
  { id: 'retro-orange', name: '复古橙', tone: '复古', rarity: '稀有', rgb: '#f97316' },
  { id: 'retro-blue', name: '复古蓝', tone: '复古', rarity: '普通', rgb: '#3b82f6' },
  { id: 'earth-brown', name: '泥棕', tone: '自然', rarity: '普通', rgb: '#8b5a2b' },
  { id: 'leaf', name: '叶绿', tone: '自然', rarity: '普通', rgb: '#22c55e' },
  { id: 'sky', name: '天空', tone: '自然', rarity: '稀有', rgb: '#38bdf8' }
];

if (!fs.existsSync(dbFile)) {
  console.error('Database not found, run reset-db first.');
  process.exit(1);
}

const db = new sqlite3.Database(dbFile);

db.serialize(() => {
  db.run('begin');
  const stmt = db.prepare('insert or ignore into pixel_blocks (id, name, tone, rarity, rgb) values (?, ?, ?, ?, ?)');
  blocks.forEach((b) => stmt.run(b.id, b.name, b.tone, b.rarity, b.rgb));
  stmt.finalize();
  db.run('commit');
  console.log(`Seeded ${blocks.length} pixel blocks.`);
});

db.close();
