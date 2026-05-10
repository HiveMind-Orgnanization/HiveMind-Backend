import express from 'express';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(bodyParser.json());

mongoose.connect('mongodb://localhost:27017/defi', { useNewUrlParser: true, useUnifiedTopology: true });

app.get('/api/features', async (req, res) => {
  // Mock features data
  const features = [
    { id: 1, title: 'Decentralized', description: 'Fully decentralized protocol.' },
    { id: 2, title: 'Secure', description: 'High security standards.' }
  ];
  res.json(features);
});

app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body;
  // Here you would typically save to the database
  console.log(`Contact form submitted: ${name}, ${email}, ${message}`);
  res.status(200).send('Message received');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});