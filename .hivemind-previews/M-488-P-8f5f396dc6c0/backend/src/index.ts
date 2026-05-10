import express from 'express';
import cors from 'cors';
import { json } from 'body-parser';

const app = express();
app.use(cors());
app.use(json());

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  // Dummy authentication logic
  if (username === 'user' && password === 'pass') {
    res.json({ success: true, token: 'dummy-jwt-token' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

app.get('/api/game', (req, res) => {
  // Dummy game state
  res.json({ boardState: 'initial', currentTurn: 'white' });
});

app.post('/api/move', (req, res) => {
  const { move } = req.body;
  // Dummy move processing
  res.json({ success: true, move });
});

app.post('/api/save', (req, res) => {
  // Dummy save logic
  res.json({ success: true });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});