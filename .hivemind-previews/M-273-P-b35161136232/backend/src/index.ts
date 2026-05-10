import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const leaderboard = [
  { player: 'Alice', score: 150 },
  { player: 'Bob', score: 120 },
  { player: 'Charlie', score: 100 },
];

app.get('/leaderboard', (req, res) => {
  res.json(leaderboard);
});

app.post('/leaderboard', (req, res) => {
  const { player, score } = req.body;
  if (typeof player === 'string' && typeof score === 'number') {
    leaderboard.push({ player, score });
    leaderboard.sort((a, b) => b.score - a.score);
    res.status(201).json({ message: 'Score added' });
  } else {
    res.status(400).json({ message: 'Invalid data' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
