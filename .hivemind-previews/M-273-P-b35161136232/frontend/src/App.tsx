import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Home from './components/Home';
import Game from './components/Game';
import Leaderboard from './components/Leaderboard';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-secondary font-sans">
      <header className="bg-primary text-secondary p-4">
        <h1 className="text-2xl">Snake Game</h1>
        <nav>
          <Link to="/" className="mr-4">Home</Link>
          <Link to="/game" className="mr-4">Play</Link>
          <Link to="/leaderboard">Leaderboard</Link>
        </nav>
      </header>
      <main className="p-4">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/game" element={<Game />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
        </Routes>
      </main>
      <footer className="bg-primary text-secondary p-4 text-center">
        <p>&copy; 2023 Snake Game</p>
      </footer>
    </div>
  );
};

export default App;