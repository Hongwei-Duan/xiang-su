import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sqlite3 from 'sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve database path relative to project root
const dbPath = path.resolve(__dirname, '..', 'data', 'pixel.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to open database:', err.message);
    process.exit(1);
  }
});

const args = process.argv.slice(2);
const tableArg = args.find((a) => !a.startsWith('-'));
const showRows = args.includes('--rows') || args.includes('-r');

db.serialize(() => {
  db.all("select name from sqlite_master where type='table' order by name", (err, rows) => {
    if (err) {
      console.error('Schema query failed:', err.message);
      process.exit(1);
    }
    const tableNames = rows.map((r) => r.name);
    console.log('Tables:', tableNames);

    if (tableArg) {
      if (!tableNames.includes(tableArg)) {
        console.error(`Table '${tableArg}' not found.`);
        db.close();
        return;
      }
      db.all(`select * from ${tableArg} limit 50`, (detailErr, detailRows) => {
        if (detailErr) {
          console.error(`Query failed for ${tableArg}:`, detailErr.message);
        } else {
          console.log(`Rows from ${tableArg}:`);
          console.table(detailRows);
        }
        db.close();
      });
      return;
    }

    // Quick row counts for main tables
    const targets = ['users', 'palettes', 'artworks', 'activities'];
    let pending = targets.length;
    targets.forEach((table) => {
      db.get(`select count(*) as count from ${table}`, (countErr, row) => {
        if (countErr) {
          console.warn(`Count for ${table} failed:`, countErr.message);
        } else {
          console.log(`${table}: ${row.count}`);
          if (showRows) {
            db.all(`select * from ${table} limit 10`, (rErr, rRows) => {
              if (rErr) {
                console.warn(`Rows for ${table} failed:`, rErr.message);
              } else {
                console.table(rRows);
              }
            });
          }
        }
        pending -= 1;
        if (pending === 0 && !showRows) {
          db.close();
        }
        if (pending === 0 && showRows) {
          // give pending queries a tick to finish tables
          setTimeout(() => db.close(), 50);
        }
      });
    });
  });
});
