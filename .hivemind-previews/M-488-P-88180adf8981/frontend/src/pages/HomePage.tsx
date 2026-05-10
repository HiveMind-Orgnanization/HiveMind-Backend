import React from 'react';
import { Link } from 'react-router-dom';

const HomePage: React.FC = () => {
  return (
    <div className="home-page">
      <header>
        <h1>Chess Game</h1>
        <nav>
          <Link to="/login">Login</Link>
        </nav>
      </header>
      <main>
        <section>
          <h2>Welcome to the Chess Game</h2>
          <p>Challenge your friends or play against the AI.</p>
          <Link to="/game" className="btn-primary">Play Now</Link>
        </section>
      </main>
      <footer>
        <Link to="/about">About</Link>
        <Link to="/contact">Contact</Link>
      </footer>
    </div>
  );
};

export default HomePage;