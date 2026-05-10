import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Lobby: React.FC = () => {
  const [games, setGames] = useState([]);
  const [gameId, setGameId] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/games`)
      .then(response => response.json())
      .then(data => setGames(data));
  }, []);

  const joinGame = () => {
    if (gameId) {
      navigate(`/game?id=${gameId}`);
    }
  };

  return (
    <div className="lobby">
      <h1>Game Lobby</h1>
      <button onClick={() => navigate('/game')}>Create Game</button>
      <input type="text" value={gameId} onChange={e => setGameId(e.target.value)} placeholder="Enter Game ID" />
      <button onClick={joinGame}>Join Game</button>
      <ul>
        {games.map(game => (
          <li key={game.id}>{game.name}</li>
        ))}
      </ul>
    </div>
  );
};

export default Lobby;