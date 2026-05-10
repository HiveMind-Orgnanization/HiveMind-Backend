import express from 'express';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import http from 'http';
import authRoutes from './routes/auth';
import gameRoutes from './routes/games';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/games', gameRoutes);

io.on('connection', (socket) => {
  console.log('a user connected');
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

mongoose.connect('mongodb://localhost:27017/ludo', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

server.listen(5000, () => {
  console.log('Server is running on port 5000');
});