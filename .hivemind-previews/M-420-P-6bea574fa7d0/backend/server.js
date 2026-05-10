const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://localhost:27017/dex', { useNewUrlParser: true, useUnifiedTopology: true });

app.get('/api/v1/prices', async (req, res) => {
    // Fetch real-time prices from the database or an external API
    res.json([]); // Placeholder
});

app.get('/api/v1/portfolio', async (req, res) => {
    // Fetch user portfolio data from the database
    res.json({ totalValue: 0 }); // Placeholder
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
