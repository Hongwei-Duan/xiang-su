import { Router } from 'express';
import requireAuth from '../middleware/auth.js';
import { getDb } from '../db/client.js';

const router = Router();

const feed = [
  { id: 1, type: 'inventory', detail: '入库 霓虹青 x8', created_at: '2 分钟前' },
  { id: 2, type: 'create', detail: '保存草稿「雨后光晕」', created_at: '10 分钟前' },
  { id: 3, type: 'market', detail: '上架「光栅行者」 0.42 ETH', created_at: '30 分钟前' }
];

router.get('/', requireAuth, (_req, res) => {
  res.json({ items: feed });
});

const toDay = (d = new Date()) => d.toISOString().slice(0, 10);

const calcStreak = (days = []) => {
  // days: array of 'YYYY-MM-DD' sorted desc
  let streak = 0;
  let cursor = new Date();
  for (const day of days) {
    const curr = toDay(cursor);
    if (day === curr) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    break;
  }
  return streak;
};

router.get('/checkin', requireAuth, async (req, res, next) => {
  try {
    const db = await getDb();
    const rows = await db.all('select day from checkins where user_id = ? order by day desc limit 14', req.user.id);
    const days = rows.map(r => r.day);
    const today = toDay();
    const claimed = days.includes(today);
    const streak = calcStreak(days);
    res.json({ claimed, streak });
  } catch (err) {
    next(err);
  }
});

export default router;
