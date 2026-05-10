import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const GameLobby: React.FC = () => {
  const [games, setGames] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/games`)
      .then(response => response.json())
      .then(data => setGames(data));
  }, []);

  const createGame = () => {
    fetch(`${import.meta.env.VITE_API_URL}/api/games/start`, {
      method: 'POST'
    }).then(() => navigate('/game'));
  };

  return (
    <div className="game-lobby">
      <h1>Game Lobby</h1>
      <button onClick={createGame}>Create Game</button>
      <ul>
        {games.map(game => (
          <li key={game.id}>{game.name}</li>
        ))}
      </ul>
    </div>
  );
};

export default GameLobby;