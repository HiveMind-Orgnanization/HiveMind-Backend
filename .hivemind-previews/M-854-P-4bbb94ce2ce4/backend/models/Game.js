const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  status: { type: String, default: 'pending' },
  currentTurn: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  boardState: { type: Array, default: [] }
});

module.exports = mongoose.model('Game', gameSchema);