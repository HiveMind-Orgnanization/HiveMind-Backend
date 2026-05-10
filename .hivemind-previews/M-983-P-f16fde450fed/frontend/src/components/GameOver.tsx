import React from 'react';

interface GameOverProps {
  onRestart: () => void;
  onInstructions: () => void;
}

const GameOver: React.FC<GameOverProps> = ({ onRestart, onInstructions }) => {
  return (
    <div className="game-over">
      <h1>Game Over</h1>
      <button onClick={onRestart}>Restart</button>
      <button onClick={onInstructions}>Instructions</button>
    </div>
  );
};

export default GameOver;