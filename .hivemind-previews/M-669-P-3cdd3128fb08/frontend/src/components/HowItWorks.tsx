import React from 'react';

const HowItWorks: React.FC = () => {
  return (
    <section className="bg-dark text-white py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-5xl font-bold mb-16 text-center drop-shadow-lg">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="bg-dark p-10 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300">
            <h3 className="text-3xl font-bold mb-6">Step 1: Connect Wallet</h3>
            <p className="text-lg">Securely connect your crypto wallet to start using our DeFi services.</p>
          </div>
          <div className="bg-dark p-10 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300">
            <h3 className="text-3xl font-bold mb-6">Step 2: Choose Service</h3>
            <p className="text-lg">Select from lending, borrowing, or yield farming to suit your needs.</p>
          </div>
          <div className="bg-dark p-10 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300">
            <h3 className="text-3xl font-bold mb-6">Step 3: Earn & Manage</h3>
            <p className="text-lg">Monitor your assets and earnings through our intuitive dashboard.</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
