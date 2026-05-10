import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://localhost:27017/snake-game', { useNewUrlParser: true, useUnifiedTopology: true });

app.post('/api/scores', (req, res) => {
  // Logic to save score
});

app.get('/api/leaderboard', (req, res) => {
  // Logic to get leaderboard
});

app.post('/api/auth/register', (req, res) => {
  // Logic to register user
});

app.post('/api/auth/login', (req, res) => {
  // Logic to login user
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
