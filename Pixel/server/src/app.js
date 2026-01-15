import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import paletteRoutes from './routes/palettes.js';
import artworkRoutes from './routes/artworks.js';
import activityRoutes from './routes/activity.js';
import rewardRoutes from './routes/rewards.js';
import errorHandler from './middleware/error.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/palettes', paletteRoutes);
app.use('/artworks', artworkRoutes);
app.use('/activity', activityRoutes);
app.use('/rewards', rewardRoutes);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
