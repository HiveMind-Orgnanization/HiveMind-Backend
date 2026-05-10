import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '..', 'snake.db');

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    score INTEGER NOT NULL,
    difficulty TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

db.exec('CREATE INDEX IF NOT EXISTS idx_scores_created_at ON scores(created_at DESC);');
db.exec('CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score DESC);');

export default db;
