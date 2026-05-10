const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();
app.use(bodyParser.json());

mongoose.connect('mongodb://localhost:27017/defi', { useNewUrlParser: true, useUnifiedTopology: true });

app.get('/api/features', (req, res) => {
  // Retrieve features from database
});

app.post('/api/contact', (req, res) => {
  // Handle contact form submission
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
