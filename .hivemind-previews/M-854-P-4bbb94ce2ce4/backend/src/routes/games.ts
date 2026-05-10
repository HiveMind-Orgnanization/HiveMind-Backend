import { Router } from 'express';
import Game from '../models/Game';

const router = Router();

router.get('/', async (req, res) => {
  const games = await Game.find();
  res.json(games);
});

router.post('/start', async (req, res) => {
  const { players } = req.body;
  const game = new Game({ players, status: 'ongoing', currentTurn: players[0], boardState: {} });
  await game.save();
  res.status(201).json(game);
});

router.post('/move', async (req, res) => {
  const { gameId, playerId, moveDetails } = req.body;
  const game = await Game.findById(gameId);
  if (!game) return res.status(404).json({ message: 'Game not found' });
  // Update game logic here
  res.json({ message: 'Move accepted' });
});

export default router;