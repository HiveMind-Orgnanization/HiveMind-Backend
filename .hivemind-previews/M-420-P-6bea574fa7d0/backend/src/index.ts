import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

// Mock data
const prices = [
  { id: 1, name: 'Bitcoin', currentPrice: 45000 },
  { id: 2, name: 'Ethereum', currentPrice: 3000 }
];

const portfolio = {
  userId: 1,
  tokens: [{ id: 1, amount: 0.5 }, { id: 2, amount: 2 }],
  totalValue: 48000
};

app.get('/api/v1/prices', (req, res) => {
  res.json(prices);
});

app.get('/api/v1/portfolio', (req, res) => {
  res.json(portfolio);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
