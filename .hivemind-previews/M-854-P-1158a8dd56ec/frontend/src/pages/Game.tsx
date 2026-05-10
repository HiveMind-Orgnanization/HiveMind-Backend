import React from 'react';

const Game: React.FC = () => {
  return (
    <div className="game">
      <h1>Game Board</h1>
      <div className="board">Game Board Layout</div>
      <div className="dice">Dice Roller</div>
      <div className="turn-indicator">Turn Indicator</div>
      <div className="scoreboard">Scoreboard</div>
      <div className="chat-box">Chat Box</div>
    </div>
  );
};

export default Game;