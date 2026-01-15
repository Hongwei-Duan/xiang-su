-- Users
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  handle TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  balance INTEGER DEFAULT 5000,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Canonical pixel blocks
CREATE TABLE IF NOT EXISTS pixel_blocks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tone TEXT,
  rarity TEXT,
  rgb TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Palette inventory
CREATE TABLE IF NOT EXISTS palettes (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  block_id TEXT,
  count INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, block_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (block_id) REFERENCES pixel_blocks(id)
);

-- Artworks
CREATE TABLE IF NOT EXISTS artworks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  price INTEGER,
  data_json TEXT,
  listed_at TEXT,
  sold_at TEXT,
  buyer_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (buyer_id) REFERENCES users(id)
);

-- Activity feed
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT,
  detail TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artwork_id INTEGER NOT NULL,
  seller_id INTEGER NOT NULL,
  buyer_id INTEGER NOT NULL,
  price INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (artwork_id) REFERENCES artworks(id),
  FOREIGN KEY (seller_id) REFERENCES users(id),
  FOREIGN KEY (buyer_id) REFERENCES users(id)
);

-- Daily check-ins
CREATE TABLE IF NOT EXISTS checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  day TEXT NOT NULL,
  granted_common INTEGER DEFAULT 0,
  granted_rare INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, day),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
