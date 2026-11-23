import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db = null;

export function initDatabase() {
  if (db) return db;

  const dbDir = path.dirname(config.dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new DatabaseSync(config.dbPath);
  
  // Enable foreign keys and WAL mode for reliability and concurrency
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');

  // Run schema
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);

  console.log(`[SecureVault DB] Initialized SQLite database at: ${config.dbPath}`);
  return db;
}

export function getDb() {
  if (!db) {
    return initDatabase();
  }
  return db;
}

// Helper methods for queries
export const dbOperations = {
  get(sql, params = []) {
    const statement = getDb().prepare(sql);
    return statement.get(...params);
  },
  all(sql, params = []) {
    const statement = getDb().prepare(sql);
    return statement.all(...params);
  },
  run(sql, params = []) {
    const statement = getDb().prepare(sql);
    return statement.run(...params);
  },
  exec(sql) {
    return getDb().exec(sql);
  }
};
