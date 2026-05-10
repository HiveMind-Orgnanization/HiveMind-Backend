import React from 'react';

const ProfilePage: React.FC = () => {
  return (
    <div className="profile-page">
      <header>
        <h1>Profile</h1>
      </header>
      <main>
        <div className="user-info">User Information</div>
        <div className="game-history">Game History</div>
        <button className="btn-secondary">Logout</button>
      </main>
    </div>
  );
};

export default ProfilePage;