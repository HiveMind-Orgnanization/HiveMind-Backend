import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import GameBoard from './components/GameBoard';
import Score from './components/Score';
import GameOver from './components/GameOver';

const App: React.FC = () => {
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const navigate = useNavigate();

  const handleGameOver = () => {
    setGameOver(true);
  };

  const restartGame = () => {
    setScore(0);
    setGameOver(false);
  };

  useEffect(() => {
    if (gameOver) {
      fetch(`${import.meta.env.VITE_API_URL}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score })
      });
    }
  }, [gameOver, score]);

  return (
    <div className="game-container">
      {gameOver ? (
        <GameOver onRestart={restartGame} onInstructions={() => navigate('/instructions')} />
      ) : (
        <>
          <Score score={score} />
          <GameBoard onScore={setScore} onGameOver={handleGameOver} />
        </>
      )}
    </div>
  );
};

export default App;