import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-green-500 text-white p-4">
      <h1 className="text-2xl font-bold">Snake Game</h1>
      <nav>
        <ul className="flex space-x-4">
          <li><a href="/" className="hover:underline">Home</a></li>
          <li><a href="/leaderboard" className="hover:underline">Leaderboard</a></li>
        </ul>
      </nav>
    </header>
  );
};

export default Header;
