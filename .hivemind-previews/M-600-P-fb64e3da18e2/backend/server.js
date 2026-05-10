const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

mongoose.connect('mongodb://localhost:27017/defi', { useNewUrlParser: true, useUnifiedTopology: true });

app.get('/api/features', async (req, res) => {
  // Fetch features from database
});

app.post('/api/contact', async (req, res) => {
  // Handle contact form submission
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});