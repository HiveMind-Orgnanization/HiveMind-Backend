import React from 'react';

const Hero: React.FC = () => {
  return (
    <section className="bg-gradient-to-r from-dark-blue to-teal flex flex-col items-center justify-center text-center text-white py-20 px-4">
      <h1 className="text-6xl md:text-8xl font-extrabold mb-6 leading-tight drop-shadow-lg">Welcome to DeFi Protocol</h1>
      <p className="text-xl md:text-3xl mb-10 max-w-2xl drop-shadow-md">Revolutionizing decentralized finance with cutting-edge technology.</p>
      <button className="bg-gold text-dark-blue px-10 py-5 rounded-full text-xl font-semibold hover:bg-teal transition-all duration-300 shadow-lg">Get Started</button>
    </section>
  );
};

export default Hero;
