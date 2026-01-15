import { Router } from 'express';
import requireAuth from '../middleware/auth.js';
import { getDb } from '../db/client.js';

const router = Router();

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const db = await getDb();
    const user = await db.get('select id, handle, email, balance, created_at from users where id = ?', req.user.id);
    if (!user) return res.status(404).json({ error: 'not_found', message: 'User not found' });
    res.json({ ...user });
  } catch (err) {
    next(err);
  }
});

router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const { handle } = req.body || {};
    if (!handle) return res.status(400).json({ error: 'bad_request', message: 'Handle required' });
    const db = await getDb();
    await db.run('update users set handle = ? where id = ?', handle, req.user.id);
    res.json({ message: 'profile updated', handle });
  } catch (err) {
    next(err);
  }
});

export default router;
