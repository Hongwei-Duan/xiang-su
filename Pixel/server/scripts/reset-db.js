import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sqlite3 from 'sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const dbFile = path.join(root, 'data', 'pixel.db');
const schemaFile = path.join(root, 'db', 'schema.sql');

if (!fs.existsSync(path.dirname(dbFile))) {
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
}

if (fs.existsSync(dbFile)) {
  fs.unlinkSync(dbFile);
  console.log('Removed existing database:', dbFile);
}

const schema = fs.readFileSync(schemaFile, 'utf8');
const db = new sqlite3.Database(dbFile);

db.exec(schema, (err) => {
  if (err) {
    console.error('Failed to apply schema:', err.message);
    process.exit(1);
  }
  console.log('Schema applied to new database.');
  db.close();
});
