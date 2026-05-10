const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://localhost/snake-game', { useNewUrlParser: true, useUnifiedTopology: true });

const scoreSchema = new mongoose.Schema({
    player: String,
    score: Number
});

const Score = mongoose.model('Score', scoreSchema);

app.post('/api/score', async (req, res) => {
    const newScore = new Score(req.body);
    await newScore.save();
    res.status(201).send(newScore);
});

app.get('/api/score', async (req, res) => {
    const scores = await Score.find().sort({ score: -1 }).limit(10);
    res.send(scores);
});

app.listen(5000, () => {
    console.log('Server running on http://localhost:5000');
});