const express = require('express');
const Game = require('../models/Game');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const games = await Game.find();
    res.json(games);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/start', async (req, res) => {
  const { players } = req.body;
  try {
    const game = new Game({ players, status: 'ongoing', currentTurn: players[0] });
    await game.save();
    res.status(201).json(game);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/move', async (req, res) => {
  const { gameId, playerId, moveDetails } = req.body;
  try {
    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ error: 'Game not found' });

    // Update game state logic here

    res.json({ message: 'Move recorded' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;