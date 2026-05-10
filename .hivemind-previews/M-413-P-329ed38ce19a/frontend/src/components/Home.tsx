import React from 'react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  return (
    <div>
      <h1>Welcome to the Snake Game</h1>
      <p>Instructions: Use arrow keys to control the snake. Eat food to grow and avoid hitting the walls or yourself!</p>
      <Link to="/game"><button>Start Game</button></Link>
      <footer>
        <Link to="/about">About</Link> | <Link to="/leaderboard">Leaderboard</Link>
      </footer>
    </div>
  );
};

export default Home;
