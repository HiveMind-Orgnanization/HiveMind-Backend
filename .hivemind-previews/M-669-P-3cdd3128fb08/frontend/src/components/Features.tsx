import React from 'react';

const Features: React.FC = () => {
  return (
    <section className="bg-gradient-to-b from-dark-blue to-dark text-white py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-5xl font-bold mb-16 text-center drop-shadow-lg">Features Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="bg-dark p-10 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300">
            <h3 className="text-3xl font-bold mb-6">Lending</h3>
            <p className="text-lg">Earn interest on your crypto assets by lending them to others.</p>
          </div>
          <div className="bg-dark p-10 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300">
            <h3 className="text-3xl font-bold mb-6">Borrowing</h3>
            <p className="text-lg">Access liquidity without selling your assets by borrowing against them.</p>
          </div>
          <div className="bg-dark p-10 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300">
            <h3 className="text-3xl font-bold mb-6">Yield Farming</h3>
            <p className="text-lg">Maximize your returns by participating in yield farming opportunities.</p>
          </div>
        </div>
        <div className="text-center mt-12">
          <button className="bg-teal text-dark-blue px-8 py-4 rounded-full text-lg font-semibold hover:bg-gold transition-all duration-300 shadow-lg focus:outline-none focus:ring-2 focus:ring-gold focus:ring-opacity-50">Learn More</button>
        </div>
      </div>
    </section>
  );
};

export default Features;
