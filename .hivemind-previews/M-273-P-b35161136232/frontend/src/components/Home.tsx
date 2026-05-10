import React from 'react';
import { useNavigate } from 'react-router-dom';

const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="text-center">
      <h2 className="text-2xl mb-4">Welcome to the Snake Game</h2>
      <p className="mb-4">Try to eat as much food as possible without hitting the walls or yourself!</p>
      <button
        className="bg-primary text-secondary px-4 py-2 rounded"
        onClick={() => navigate('/game')}
      >
        Play Now
      </button>
    </div>
  );
};

export default Home;