import React from 'react';
import { useNavigate } from 'react-router-dom';

const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="home">
      <h1>Ludo Game</h1>
      <button onClick={() => navigate('/lobby')}>Play Now</button>
      <section className="about">
        <h2>About Ludo</h2>
        <p>Ludo is a strategy board game for two to four players, in which the players race their four tokens from start to finish according to the rolls of a single die.</p>
      </section>
      <footer>
        <p>&copy; 2023 Ludo Game</p>
      </footer>
    </div>
  );
};

export default Home;