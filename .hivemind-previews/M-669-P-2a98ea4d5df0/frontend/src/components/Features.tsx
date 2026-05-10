import React from 'react';

const Features: React.FC = () => {
  return (
    <section className="bg-dark-blue text-white py-16">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl font-bold mb-8 text-center">Features Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-dark p-6 rounded-lg shadow-lg">
            <h3 className="text-2xl font-bold mb-4">Lending</h3>
            <p>Earn interest on your crypto assets by lending them to others.</p>
          </div>
          <div className="bg-dark p-6 rounded-lg shadow-lg">
            <h3 className="text-2xl font-bold mb-4">Borrowing</h3>
            <p>Access liquidity without selling your assets by borrowing against them.</p>
          </div>
          <div className="bg-dark p-6 rounded-lg shadow-lg">
            <h3 className="text-2xl font-bold mb-4">Yield Farming</h3>
            <p>Maximize your returns by participating in yield farming opportunities.</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;
