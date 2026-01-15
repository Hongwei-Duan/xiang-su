import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export async function getDb() {
  const db = await open({
    filename: process.env.DATABASE_URL?.replace('sqlite:', '') || './data/pixel.db',
    driver: sqlite3.Database,
  });
  return db;
}
