import React from 'react';

const Game: React.FC = () => {
  return (
    <div>
      <h1>Game Page</h1>
      <div id="chess-board">Chess Board Placeholder</div>
      <div id="player-info">Player Information</div>
      <div id="move-history">Move History</div>
      <div id="chat-box">Chat Box</div>
      <button>Save Game</button>
    </div>
  );
};

export default Game;