import React from 'react';

const About: React.FC = () => {
  return (
    <div>
      <h1>About the Snake Game</h1>
      <p>This game is a classic implementation of the Snake game, developed using React.</p>
      <footer>
        <Link to="/">Home</Link> | <Link to="/leaderboard">Leaderboard</Link>
      </footer>
    </div>
  );
};

export default About;
