import React from 'react';
import { Link } from 'react-router-dom';

const Navbar: React.FC = () => {
  return (
    <nav className="bg-dark-blue text-white p-4 flex justify-between items-center">
      <div className="text-2xl font-bold">DeFi Protocol</div>
      <div className="hidden md:flex space-x-4">
        <Link to="/" className="hover:text-teal">Home</Link>
        <Link to="/features" className="hover:text-teal">Features</Link>
        <Link to="/about" className="hover:text-teal">About</Link>
        <Link to="/contact" className="hover:text-teal">Contact</Link>
      </div>
    </nav>
  );
};

export default Navbar;
