import React from 'react';

const Profile: React.FC = () => {
  return (
    <div>
      <header>
        <h1>Profile</h1>
      </header>
      <main>
        <div>User Information</div>
        <div>Game History</div>
        <button>Logout</button>
      </main>
    </div>
  );
};

export default Profile;