import { Router } from 'express';
import requireAuth from '../middleware/auth.js';
import { getDb } from '../db/client.js';

const router = Router();

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const upsertPalette = async (db, userId, block, delta) => {
  const existing = await db.get('select id, count from palettes where user_id = ? and block_id = ?', userId, block.id);
  if (existing) {
    const next = Math.max(0, (existing.count || 0) + delta);
    await db.run('update palettes set count = ?, updated_at = CURRENT_TIMESTAMP where id = ?', next, existing.id);
  } else {
    const paletteId = `${block.id}-${userId}`;
    await db.run('insert into palettes (id, user_id, block_id, count) values (?, ?, ?, ?)', paletteId, userId, block.id, delta);
  }
  return {
    blockId: block.id,
    name: block.name,
    tone: block.tone,
    rarity: block.rarity,
    rgb: block.rgb,
    count: delta
  };
};

router.post('/checkin', requireAuth, async (req, res, next) => {
  const today = new Date().toISOString().slice(0, 10);
  let db;
  try {
    db = await getDb();
    await db.run('begin');
    const already = await db.get('select 1 from checkins where user_id = ? and day = ?', req.user.id, today);
    if (already) {
      await db.run('rollback');
      return res.status(409).json({ error: 'already_claimed', message: '今日已签到领取' });
    }

    const blocks = await db.all('select id, name, tone, rarity, rgb from pixel_blocks');
    const common = blocks.filter(b => b.rarity === '普通');
    const rarePool = blocks.filter(b => b.rarity === '稀有');
    if (!common.length) {
      await db.run('rollback');
      return res.status(400).json({ error: 'no_blocks', message: '缺少普通像素块配置' });
    }

    const rareCandidate = rarePool.length ? rarePool : common;
    const picks = [];
    for (let i = 0; i < 9; i++) {
      picks.push(pickRandom(common));
    }
    picks.push(pickRandom(rareCandidate));

    const aggregated = picks.reduce((acc, block) => {
      acc[block.id] = (acc[block.id] || 0) + 1;
      return acc;
    }, {});

    const granted = [];
    for (const [blockId, qty] of Object.entries(aggregated)) {
      const block = blocks.find(b => b.id === blockId);
      if (!block) continue;
      const result = await upsertPalette(db, req.user.id, block, qty);
      granted.push(result);
    }

    await db.run('insert into checkins (user_id, day, granted_common, granted_rare) values (?, ?, ?, ?)', req.user.id, today, 9, 1);
    await db.run('commit');

    res.json({ date: today, granted, totals: { common: 9, rare: 1 } });
  } catch (err) {
    if (db) {
      try {
        await db.run('rollback');
      } catch (_e) {
        // ignore rollback errors
      }
    }
    next(err);
  }
});

export default router;
