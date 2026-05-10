import React from 'react';

const Profile: React.FC = () => {
  return (
    <div className="profile">
      <h1>User Profile</h1>
      <div className="user-info">User Information</div>
      <button>Edit Profile</button>
      <div className="game-history">Game History</div>
      <button>Logout</button>
    </div>
  );
};

export default Profile;