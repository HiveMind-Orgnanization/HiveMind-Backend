import express from 'express';
import bodyParser from 'body-parser';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

const app = express();
const port = 5000;
const pool = new Pool({
  user: 'your_db_user',
  host: 'localhost',
  database: 'your_db_name',
  password: 'your_db_password',
  port: 5432,
});

app.use(bodyParser.json());

app.post('/api/signup', async (req, res) => {
  const { username, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await pool.query('INSERT INTO users (username, email, passwordHash, isVerified, createdAt) VALUES ($1, $2, $3, $4, $5) RETURNING *', [username, email, hashedPassword, false, new Date()]);
  const user = result.rows[0];
  // Send verification email logic here
  res.status(201).json({ message: 'User created', user });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});