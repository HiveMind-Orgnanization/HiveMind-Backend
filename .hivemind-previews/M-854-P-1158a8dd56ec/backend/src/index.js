const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://localhost:27017/ludo', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

app.post('/api/auth/register', (req, res) => {
  // Registration logic
});

app.post('/api/auth/login', (req, res) => {
  // Login logic
});

app.get('/api/games', (req, res) => {
  // Retrieve games logic
});

app.post('/api/games/start', (req, res) => {
  // Start game logic
});

app.post('/api/games/move', (req, res) => {
  // Move logic
});

io.on('connection', (socket) => {
  console.log('a user connected');
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

server.listen(5000, () => {
  console.log('Server is running on port 5000');
});