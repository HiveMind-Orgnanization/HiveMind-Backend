import express from 'express';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = 'your_secret_key';

app.use(bodyParser.json());

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  // Here you would validate the username and password with your database
  if (username === 'user' && password === 'pass') {
    const token = jwt.sign({ username }, SECRET_KEY);
    return res.json({ token });
  }
  return res.status(401).json({ message: 'Invalid credentials' });
});

app.post('/api/recover-password', (req, res) => {
  const { email } = req.body;
  // Implement password recovery logic here
  return res.json({ message: 'Password recovery link sent' });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});