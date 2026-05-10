import React from 'react';

const GamePage: React.FC = () => {
  return (
    <div className="game-page">
      <header>
        <h1>Chess Game</h1>
      </header>
      <main>
        <div className="chess-board">Chess Board Placeholder</div>
        <div className="player-info">Player Information</div>
        <div className="move-history">Move History</div>
        <div className="chat-box">Chat Box</div>
        <button className="btn-secondary">Save Game</button>
      </main>
    </div>
  );
};

export default GamePage;