import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://localhost:27017/snake-game', { useNewUrlParser: true, useUnifiedTopology: true });

const scoreSchema = new mongoose.Schema({
  score: Number,
});
const Score = mongoose.model('Score', scoreSchema);

app.get('/api/score', async (req, res) => {
  const scores = await Score.find();
  res.json(scores);
});

app.post('/api/score', async (req, res) => {
  const newScore = new Score(req.body);
  await newScore.save();
  res.status(201).send();
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
