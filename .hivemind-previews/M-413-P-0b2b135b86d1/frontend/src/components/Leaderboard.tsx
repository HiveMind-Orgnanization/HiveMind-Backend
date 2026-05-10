import React, { useEffect, useState } from 'react';

const Leaderboard: React.FC = () => {
  const [scores, setScores] = useState([]);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/leaderboard`)
      .then(response => response.json())
      .then(data => setScores(data));
  }, []);

  return (
    <div>
      <h1>Leaderboard</h1>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Username</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {scores.map((score, index) => (
            <tr key={score.id}>
              <td>{index + 1}</td>
              <td>{score.username}</td>
              <td>{score.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={() => { /* Refresh logic */ }}>Refresh</button>
      <footer>
        <Link to="/">Home</Link> | <Link to="/about">About</Link>
      </footer>
    </div>
  );
};

export default Leaderboard;
