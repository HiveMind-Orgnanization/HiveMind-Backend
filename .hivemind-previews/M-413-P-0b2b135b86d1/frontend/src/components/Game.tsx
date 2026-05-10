import React, { useEffect, useRef, useState } from 'react';

const Game: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    // Game logic here
    // Draw snake, food, and handle game over
  }, []);

  return (
    <div>
      <canvas ref={canvasRef} width={400} height={400} style={{ backgroundColor: '#000' }}></canvas>
      <h2>Score: {score}</h2>
      <button onClick={() => { /* Pause/Resume logic */ }}>Pause/Resume</button>
      <button onClick={() => { /* Restart logic */ }}>Restart</button>
      <footer>
        <Link to="/">Home</Link> | <Link to="/leaderboard">Leaderboard</Link>
      </footer>
    </div>
  );
};

export default Game;
