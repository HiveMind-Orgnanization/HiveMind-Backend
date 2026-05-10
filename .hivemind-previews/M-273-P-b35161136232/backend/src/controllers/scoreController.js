const Score = require('../models/Score');

exports.getScores = async (req, res) => {
  try {
    const scores = await Score.find().sort({ score: -1 }).limit(10);
    res.json(scores);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving scores' });
  }
};

exports.addScore = async (req, res) => {
  try {
    const { playerName, score } = req.body;
    const newScore = new Score({ playerName, score });
    await newScore.save();
    res.status(201).json(newScore);
  } catch (error) {
    res.status(500).json({ message: 'Error saving score' });
  }
};
