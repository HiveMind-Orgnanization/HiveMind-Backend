import React, { useState, useEffect } from 'react';

const Game: React.FC = () => {
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  useEffect(() => {
    // Initialize game logic here
  }, []);

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4">
        <h2 className="text-xl">Score: {score}</h2>
        <h3 className="text-lg">High Score: {highScore}</h3>
      </div>
      <div className="bg-gray-200 w-full h-64 flex justify-center items-center">
        {/* Game board will be implemented here */}
        <p>Game Board</p>
      </div>
      <div className="mt-4">
        <button className="bg-primary text-secondary px-4 py-2 mr-2 rounded">Start</button>
        <button className="bg-primary text-secondary px-4 py-2 mr-2 rounded">Pause</button>
        <button className="bg-primary text-secondary px-4 py-2 rounded">Restart</button>
      </div>
    </div>
  );
};

export default Game;