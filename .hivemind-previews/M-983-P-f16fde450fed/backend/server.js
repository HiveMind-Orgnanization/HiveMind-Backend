const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/api/score', (req, res) => {
  res.json({ score: 0 }); // Placeholder for actual score retrieval logic
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});