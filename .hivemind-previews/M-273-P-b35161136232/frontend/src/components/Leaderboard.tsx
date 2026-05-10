import React from 'react';

const Leaderboard: React.FC = () => {
  const players = [
    { name: 'Player 1', score: 100 },
    { name: 'Player 2', score: 90 },
    { name: 'Player 3', score: 80 }
  ];

  return (
    <div className="text-center">
      <h2 className="text-2xl mb-4">Leaderboard</h2>
      <table className="min-w-full bg-white">
        <thead>
          <tr>
            <th className="py-2">Player</th>
            <th className="py-2">Score</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player, index) => (
            <tr key={index} className="bg-gray-100">
              <td className="py-2">{player.name}</td>
              <td className="py-2">{player.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Leaderboard;