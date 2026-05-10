import mongoose from 'mongoose';

const gameSchema = new mongoose.Schema({
  players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  status: { type: String, default: 'waiting' },
  currentTurn: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  boardState: { type: Object, default: {} }
});

export default mongoose.model('Game', gameSchema);