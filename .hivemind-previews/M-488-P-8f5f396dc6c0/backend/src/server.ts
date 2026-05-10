import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  // Authenticate user
  res.status(200).json({ message: 'Login successful' });
});

app.get('/api/game', (req, res) => {
  // Retrieve game state
  res.status(200).json({ boardState: '...' });
});

app.post('/api/move', (req, res) => {
  const { move } = req.body;
  // Process move
  res.status(200).json({ message: 'Move accepted' });
});

app.post('/api/save', (req, res) => {
  // Save game state
  res.status(200).json({ message: 'Game saved' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});