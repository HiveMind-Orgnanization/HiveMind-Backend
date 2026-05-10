import React from 'react';

const Hero: React.FC = () => {
  return (
    <section className="bg-dark flex flex-col items-center justify-center text-center text-white py-20">
      <h1 className="text-4xl md:text-6xl font-bold mb-4">Welcome to DeFi Protocol</h1>
      <p className="text-xl md:text-2xl mb-8">Revolutionizing decentralized finance with cutting-edge technology.</p>
      <button className="bg-teal text-dark-blue px-6 py-3 rounded-full text-lg hover:bg-gold transition">Get Started</button>
    </section>
  );
};

export default Hero;
