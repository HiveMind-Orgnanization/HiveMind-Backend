const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.json());

mongoose.connect('mongodb://localhost/snake-game', { useNewUrlParser: true, useUnifiedTopology: true });

app.post('/api/scores', (req, res) => {
    // Logic to save score
});

app.get('/api/leaderboard', (req, res) => {
    // Logic to get leaderboard
});

app.listen(5000, () => {
    console.log('Server running on port 5000');
});