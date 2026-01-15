import { Router } from 'express';
import requireAuth from '../middleware/auth.js';
import { getDb } from '../db/client.js';

const router = Router();

const asInt = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.trunc(v);
};

const withParsedData = (row) => {
  if (!row) return row;
  try {
    if (typeof row.data === 'string') {
      row.data = JSON.parse(row.data);
    }
  } catch (_err) {
    row.data = {};
  }
  return row;
};

router.get('/feed/listed', async (_req, res, next) => {
  try {
    const db = await getDb();
    const items = await db.all(
      `select a.id, a.title, a.price, a.status, a.data_json as data, a.listed_at,
              u.handle as seller_handle, u.id as seller_id
         from artworks a
         join users u on u.id = a.user_id
        where a.status = 'listed'
        order by a.listed_at desc`
    );
    res.json({ items: items.map(withParsedData) });
  } catch (err) {
    next(err);
  }
});

router.get('/public/:id', async (req, res, next) => {
  try {
    const db = await getDb();
    const row = await db.get(
      `select a.id, a.title, a.status, a.price, a.data_json as data, a.listed_at, a.sold_at, a.user_id, a.buyer_id,
              u.handle as seller_handle
         from artworks a
         join users u on u.id = a.user_id
        where a.id = ?`,
      req.params.id
    );
    if (!row || (row.status !== 'listed' && row.status !== 'sold')) {
      return res.status(404).json({ error: 'not_found', message: '作品不可查看' });
    }
    res.json(withParsedData(row));
  } catch (err) {
    next(err);
  }
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { status } = req.query;
    const db = await getDb();
    const params = [req.user.id];
    let sql = 'select id, title, status, price, data_json as data, created_at, updated_at from artworks where user_id = ?';
    if (status) {
      sql += ' and status = ?';
      params.push(status);
    }
    sql += ' order by updated_at desc';
    const items = await db.all(sql, ...params);
    res.json({ items: items.map(withParsedData) });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { title, data = {} } = req.body || {};
    if (!title) return res.status(400).json({ error: 'bad_request', message: '标题必填' });
    const db = await getDb();
    const result = await db.run(
      'insert into artworks (user_id, title, status, price, data_json) values (?, ?, ?, ?, ?)',
      req.user.id,
      title,
      'draft',
      null,
      JSON.stringify(data)
    );
    const row = await db.get('select id, title, status, price, data_json as data, created_at, updated_at from artworks where id = ?', result.lastID);
    res.status(201).json(withParsedData(row));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const db = await getDb();
    const row = await db.get('select id, title, status, price, data_json as data, created_at, updated_at, buyer_id, listed_at, sold_at from artworks where id = ? and user_id = ?', req.params.id, req.user.id);
    if (!row) return res.status(404).json({ error: 'not_found', message: '画作不存在' });
    res.json(withParsedData(row));
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, data, action, price } = req.body || {};
    const db = await getDb();
    const art = await db.get('select * from artworks where id = ? and user_id = ?', id, req.user.id);
    if (!art) return res.status(404).json({ error: 'not_found', message: '画作不存在' });

    // prevent edits when listed unless unlisting
    if (art.status === 'listed' && action !== 'unlist') {
      return res.status(400).json({ error: 'bad_request', message: '已上架画作不可修改，请先撤销上架' });
    }

    if (action === 'list') {
      const priceInt = asInt(price);
      if (!priceInt || priceInt <= 0) return res.status(400).json({ error: 'bad_request', message: '上架价格需为正整数像素币' });
      await db.run(
        'update artworks set status = ?, price = ?, listed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP where id = ? and user_id = ?',
        'listed',
        priceInt,
        id,
        req.user.id
      );
    } else if (action === 'unlist') {
      await db.run(
        'update artworks set status = ?, price = NULL, listed_at = NULL, updated_at = CURRENT_TIMESTAMP where id = ? and user_id = ?',
        'draft',
        id,
        req.user.id
      );
    } else {
      // normal draft update
      await db.run(
        'update artworks set title = ?, data_json = ?, updated_at = CURRENT_TIMESTAMP where id = ? and user_id = ?',
        title || art.title,
        data ? JSON.stringify(data) : art.data_json,
        id,
        req.user.id
      );
    }

    const updated = await db.get('select id, title, status, price, data_json as data, created_at, updated_at, listed_at, sold_at from artworks where id = ?', id);
    res.json(withParsedData(updated));
  } catch (err) {
    next(err);
  }
});

router.post('/:id/purchase', requireAuth, async (req, res, next) => {
  try {
    const db = await getDb();
    const art = await db.get('select * from artworks where id = ?', req.params.id);
    if (!art || art.status !== 'listed') return res.status(400).json({ error: 'bad_request', message: '画作不可购买' });
    if (art.user_id === req.user.id) return res.status(400).json({ error: 'bad_request', message: '不能购买自己的画作' });
    const buyer = await db.get('select id, balance from users where id = ?', req.user.id);
    if (!buyer || buyer.balance < art.price) return res.status(400).json({ error: 'bad_request', message: '像素币余额不足' });

    const seller = await db.get('select id, balance from users where id = ?', art.user_id);

    let usage = [];
    try {
      const parsed = art.data_json ? JSON.parse(art.data_json) : {};
      usage = Array.isArray(parsed.usage) ? parsed.usage : [];
    } catch (_) {
      usage = [];
    }

    const ensureBlock = async (entry) => {
      const base = entry.baseId || entry.blockId || entry.name || 'pix';
      const blockId = base.replace(/\s+/g, '-').toLowerCase();
      let block = await db.get('select id, name, tone, rarity, rgb from pixel_blocks where id = ?', blockId);
      if (!block) {
        await db.run(
          'insert into pixel_blocks (id, name, tone, rarity, rgb) values (?, ?, ?, ?, ?)',
          blockId,
          entry.name || entry.baseId || '像素',
          entry.tone || '',
          entry.rarity || '',
          entry.rgb || '#000000'
        );
        block = await db.get('select id, name, tone, rarity, rgb from pixel_blocks where id = ?', blockId);
      }
      return block;
    };

    const adjustPalette = async (userId, entry, delta) => {
      const block = await ensureBlock(entry);
      const row = await db.get('select id, count from palettes where user_id = ? and block_id = ?', userId, block.id);
      if (row) {
        const nextCount = Math.max(0, row.count + delta);
        await db.run('update palettes set count = ?, updated_at = CURRENT_TIMESTAMP where id = ?', nextCount, row.id);
      } else if (delta > 0) {
        const newId = `${block.id}-${userId}`;
        await db.run('insert into palettes (id, user_id, block_id, count) values (?, ?, ?, ?)', newId, userId, block.id, delta);
      }
    };

    await db.run('begin');
    await db.run('update users set balance = balance - ? where id = ?', art.price, buyer.id);
    await db.run('update users set balance = balance + ? where id = ?', art.price, seller.id);
    for (const entry of usage) {
      const amount = Number(entry.count) || 0;
      if (amount <= 0) continue;
      await adjustPalette(seller.id, entry, -amount);
      await adjustPalette(buyer.id, entry, amount);
    }
    await db.run(
      'update artworks set status = ?, buyer_id = ?, sold_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, user_id = ?, listed_at = NULL where id = ?',
      'sold',
      buyer.id,
      buyer.id,
      art.id
    );
    await db.run(
      'insert into transactions (artwork_id, seller_id, buyer_id, price) values (?, ?, ?, ?)',
      art.id,
      seller.id,
      buyer.id,
      art.price
    );
    await db.run('commit');

    const updated = await db.get('select id, title, status, price, data_json as data, buyer_id, sold_at from artworks where id = ?', art.id);
    res.json(withParsedData(updated));
  } catch (err) {
    try { const db = await getDb(); await db.run('rollback'); } catch (_) {}
    next(err);
  }
});

export default router;
