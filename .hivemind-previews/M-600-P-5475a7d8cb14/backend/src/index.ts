import express from 'express';
import bodyParser from 'body-parser';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(bodyParser.json());

app.get('/api/features', (req, res) => {
  const features = [
    { id: 1, title: 'Lending', description: 'Borrow and lend assets seamlessly.' },
    { id: 2, title: 'Trading', description: 'Trade assets without intermediaries.' }
  ];
  res.json(features);
});

app.post('/api/contact', (req, res) => {
  const { name, email, message } = req.body;
  // Here you would handle the contact inquiry (e.g., save to DB, send email)
  res.status(201).send('Inquiry received');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});