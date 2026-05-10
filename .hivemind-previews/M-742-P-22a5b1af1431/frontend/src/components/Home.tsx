import React from 'react';

const Home: React.FC = () => {
  return (
    <div>
      <h1>Welcome to Our DeFi Protocol</h1>
      <p>Discover the future of finance.</p>
      <button onClick={() => window.location.href='/contact'}>Get Started</button>
    </div>
  );
};

export default Home;