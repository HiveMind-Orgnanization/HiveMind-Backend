import { Router } from 'express';
import db from '../db';

const router = Router();

interface ScoreRow {
  id: number;
  name: string;
  score: number;
  difficulty: string;
  created_at: number;
}

router.get('/', (req, res) => {
  try {
    const range = (req.query.range as string) || 'all';
    let rows: ScoreRow[] = [];

    if (range === 'week') {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const stmt = db.prepare<unknown, ScoreRow>('SELECT id, name, score, difficulty, created_at FROM scores WHERE created_at >= ? ORDER BY score DESC, created_at ASC LIMIT 50');
      rows = stmt.all(weekAgo);
    } else {
      const stmt = db.prepare<unknown, ScoreRow>('SELECT id, name, score, difficulty, created_at FROM scores ORDER BY score DESC, created_at ASC LIMIT 50');
      rows = stmt.all();
    }

    const scores = rows.map((r) => ({
      id: r.id,
      name: r.name,
      score: r.score,
      difficulty: r.difficulty,
      createdAt: r.created_at,
    }));

    res.json({ scores });
  } catch (err) {
    console.error('Error fetching leaderboard', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

router.post('/', (req, res) => {
  try {
    const { name, score, difficulty } = req.body || {};

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const trimmedName = name.trim().slice(0, 20);

    if (typeof score !== 'number' || !Number.isFinite(score) || score <= 0 || score > 1000000) {
      return res.status(400).json({ error: 'Invalid score' });
    }

    const allowedDifficulties = ['easy', 'normal', 'hard'];
    if (typeof difficulty !== 'string' || !allowedDifficulties.includes(difficulty)) {
      return res.status(400).json({ error: 'Invalid difficulty' });
    }

    const createdAt = Date.now();

    const stmt = db.prepare('INSERT INTO scores (name, score, difficulty, created_at) VALUES (?, ?, ?, ?)');
    const info = stmt.run(trimmedName, score, difficulty, createdAt);

    res.status(201).json({
      id: info.lastInsertRowid,
      name: trimmedName,
      score,
      difficulty,
      createdAt,
    });
  } catch (err) {
    console.error('Error saving score', err);
    res.status(500).json({ error: 'Failed to save score' });
  }
});

export default router;
