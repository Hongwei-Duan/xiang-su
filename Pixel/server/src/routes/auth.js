import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getDb } from '../db/client.js';

const router = Router();

const STARTER_BLOCKS = [
  { id: 'neon-cyan', name: '霓虹青', tone: '霓虹', rarity: '稀有', rgb: '#0ea5e9', count: 42 },
  { id: 'neon-pink', name: '霓虹粉', tone: '霓虹', rarity: '罕见', rgb: '#ef5da8', count: 24 },
  { id: 'neon-purple', name: '霓虹紫', tone: '霓虹', rarity: '罕见', rgb: '#a855f7', count: 18 },
  { id: 'soft-yellow', name: '柔黄', tone: '柔和', rarity: '普通', rgb: '#f5d565', count: 36 },
  { id: 'soft-coral', name: '珊瑚', tone: '柔和', rarity: '稀有', rgb: '#f58b7c', count: 28 },
  { id: 'soft-mint', name: '薄荷', tone: '柔和', rarity: '普通', rgb: '#7ad9c1', count: 30 },
  { id: 'retro-green', name: '复古绿', tone: '复古', rarity: '普通', rgb: '#3ba56a', count: 40 },
  { id: 'retro-orange', name: '复古橙', tone: '复古', rarity: '稀有', rgb: '#f97316', count: 22 },
  { id: 'retro-blue', name: '复古蓝', tone: '复古', rarity: '普通', rgb: '#3b82f6', count: 34 },
  { id: 'earth-brown', name: '泥棕', tone: '自然', rarity: '普通', rgb: '#8b5a2b', count: 26 },
  { id: 'leaf', name: '叶绿', tone: '自然', rarity: '普通', rgb: '#22c55e', count: 32 },
  { id: 'sky', name: '天空', tone: '自然', rarity: '稀有', rgb: '#38bdf8', count: 27 }
];

async function ensurePalette(db, userId) {
  const existing = await db.get('select 1 from palettes where user_id = ? limit 1', userId);
  if (existing) return;
  const stmt = await db.prepare('insert into palettes (id, user_id, block_id, count) values (?, ?, ?, ?)');
  try {
    for (const p of STARTER_BLOCKS) {
      const block = await db.get('select id from pixel_blocks where id = ?', p.id);
      if (!block) {
        await db.run('insert into pixel_blocks (id, name, tone, rarity, rgb) values (?, ?, ?, ?, ?)', p.id, p.name, p.tone, p.rarity, p.rgb);
      }
      const paletteId = `${p.id}-${userId}`;
      await stmt.run(paletteId, userId, p.id, p.count);
    }
  } finally {
    await stmt.finalize();
  }
}

async function ensureDemoUser(db) {
  const email = 'demo@example.com';
  let user = await db.get('select * from users where email = ?', email);
  if (!user) {
    const hash = await bcrypt.hash('password', 10);
    const result = await db.run('insert into users (handle, email, password_hash, balance) values (?, ?, ?, ?)', 'pixelwalker', email, hash, 5000);
    user = { id: result.lastID, handle: 'pixelwalker', email, password_hash: hash, balance: 5000 };
  }
  await ensurePalette(db, user.id);
  return user;
}

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'bad_request', message: 'Email and password required' });

    const db = await getDb();
    let user = await db.get('select * from users where email = ?', email);
    if (!user && email === 'demo@example.com') {
      user = await ensureDemoUser(db);
    }
    if (!user) return res.status(401).json({ error: 'unauthorized', message: '账号或密码错误' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'unauthorized', message: '账号或密码错误' });

    await ensurePalette(db, user.id);
    const token = jwt.sign({ sub: user.id, handle: user.handle, email: user.email }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '8h' });
    res.json({ token, user: { id: user.id, handle: user.handle, email: user.email } });
  } catch (err) {
    next(err);
  }
});

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, handle } = req.body || {};
    if (!email || !password || !handle) return res.status(400).json({ error: 'bad_request', message: 'Email, password, handle required' });

    const db = await getDb();
    const existingEmail = await db.get('select id from users where email = ?', email);
    if (existingEmail) return res.status(409).json({ error: 'conflict', message: '该邮箱已注册' });
    const existingHandle = await db.get('select id from users where handle = ?', handle);
    if (existingHandle) return res.status(409).json({ error: 'conflict', message: '昵称已被占用' });

    const hash = await bcrypt.hash(password, 10);
    const result = await db.run('insert into users (handle, email, password_hash, balance) values (?, ?, ?, ?)', handle, email, hash, 5000);
    const userId = result.lastID;
    await ensurePalette(db, userId);

    const token = jwt.sign({ sub: userId, handle, email }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '8h' });
    res.status(201).json({ token, user: { id: userId, handle, email } });
  } catch (err) {
    next(err);
  }
});

export default router;
