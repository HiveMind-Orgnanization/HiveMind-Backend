import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

let currentScore = 0;

app.get('/api/score', (req, res) => {
  res.json({ score: currentScore });
});

app.post('/api/score', (req, res) => {
  const { score } = req.body;
  if (typeof score === 'number') {
    currentScore = score;
    res.status(200).json({ message: 'Score updated' });
  } else {
    res.status(400).json({ message: 'Invalid score' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});