import { Router } from 'express';
import requireAuth from '../middleware/auth.js';
import { getDb } from '../db/client.js';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { tone, rarity, excludeArtworkId } = req.query;
    const db = await getDb();
    const params = [req.user.id];
    let query = `
      select p.id, p.block_id, p.count, p.updated_at,
             b.name, b.tone, b.rarity, b.rgb
        from palettes p
        left join pixel_blocks b on b.id = p.block_id
       where p.user_id = ?`;
    if (tone) {
      query += ' and b.tone = ?';
      params.push(tone);
    }
    if (rarity) {
      query += ' and b.rarity = ?';
      params.push(rarity);
    }
    query += ' order by b.name collate nocase';
    const palettes = await db.all(query, ...params);

    const artworks = await db.all(
      'select id, data_json from artworks where user_id = ? and status in ("draft", "listed") and data_json is not null',
      req.user.id
    );
    const reserved = new Map();
    const blockNameMap = new Map();
    palettes.forEach(p => { if (p?.name) blockNameMap.set(p.name, p.block_id); });

    const resolveBlockId = (entry = {}) => {
      if (entry.blockId) return entry.blockId;
      if (entry.baseId) return entry.baseId;
      if (entry.id) {
        const base = String(entry.id).split('-')[0];
        if (base) return base;
      }
      if (entry.name && blockNameMap.has(entry.name)) return blockNameMap.get(entry.name);
      return null;
    };

    artworks.forEach(row => {
      if (!row?.data_json) return;
      if (excludeArtworkId && String(row.id) === String(excludeArtworkId)) return;
      try {
        const data = JSON.parse(row.data_json);
        if (Array.isArray(data.usage)) {
          data.usage.forEach((u) => {
            const blk = resolveBlockId(u);
            if (!blk) return;
            const qty = Number(u.count) || 0;
            if (qty <= 0) return;
            reserved.set(blk, (reserved.get(blk) || 0) + qty);
          });
        }
      } catch (_) {
        // ignore parse errors
      }
    });

    const result = palettes
      .map((p) => {
        const hold = reserved.get(p.block_id) || 0;
        const available = Math.max(0, (p.count || 0) - hold);
        return available > 0
          ? {
              ...p,
              count: available,
              total_count: p.count,
              reserved: hold
            }
          : null;
      })
      .filter(Boolean);

    res.json({ items: result });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { delta } = req.body || {};
    const change = Number(delta) || 0;
    const db = await getDb();
    const existing = await db.get('select count from palettes where id = ? and user_id = ?', id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'not_found', message: 'Palette not found' });

    const newCount = Math.max(0, existing.count + change);
    await db.run('update palettes set count = ?, updated_at = CURRENT_TIMESTAMP where id = ? and user_id = ?', newCount, id, req.user.id);
    res.json({ id, count: newCount });
  } catch (err) {
    next(err);
  }
});

export default router;
