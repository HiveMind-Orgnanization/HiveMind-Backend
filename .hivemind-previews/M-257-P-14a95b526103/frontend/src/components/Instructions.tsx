import React from 'react';
import { useNavigate } from 'react-router-dom';

const Instructions: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div>
      <h1>Instructions</h1>
      <p>Use the arrow keys to control the snake.</p>
      <p>Eat the red food to grow your snake and increase your score.</p>
      <p>Avoid colliding with the walls or yourself!</p>
      <button onClick={() => navigate('/game')}>Back to Game</button>
    </div>
  );
};

export default Instructions;
