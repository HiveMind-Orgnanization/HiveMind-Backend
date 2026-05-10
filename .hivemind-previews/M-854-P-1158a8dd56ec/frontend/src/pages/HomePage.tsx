import React from 'react';

const HomePage: React.FC = () => {
  return (
    <div>
      <h1>Welcome to Ludo Game</h1>
      <button onClick={() => window.location.href = '/lobby'}>Play Now</button>
      <section>
        <h2>About</h2>
        <p>This is a fully functional Ludo game where you can play with friends in real-time.</p>
      </section>
      <footer>
        <p>&copy; 2023 Ludo Game</p>
      </footer>
    </div>
  );
};

export default HomePage;