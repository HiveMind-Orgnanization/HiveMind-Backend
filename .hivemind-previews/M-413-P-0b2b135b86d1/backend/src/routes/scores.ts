import { Router } from 'express';
import Score from '../models/Score';

const router = Router();

router.get('/', async (req, res) => {
  const scores = await Score.find().sort({ score: -1 }).limit(10);
  res.json(scores);
});

router.post('/', async (req, res) => {
  const newScore = new Score(req.body);
  await newScore.save();
  res.status(201).json(newScore);
});

export { router as scoreRouter };
