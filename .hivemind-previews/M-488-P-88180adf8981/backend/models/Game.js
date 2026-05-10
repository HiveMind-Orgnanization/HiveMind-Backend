const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  player1Id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  player2Id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  boardState: { type: String, required: true },
  currentTurn: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Game', gameSchema);