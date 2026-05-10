import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="bg-dark-blue text-white p-4 flex justify-between items-center shadow-md">
      <div className="text-2xl font-bold">DeFi Protocol</div>
      <div className="md:hidden">
        <button onClick={() => setIsOpen(!isOpen)} className="focus:outline-none">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path>
          </svg>
        </button>
      </div>
      <div className={`md:flex space-x-4 ${isOpen ? 'block' : 'hidden'}`}>
        <Link to="/" className="hover:text-teal">Home</Link>
        <Link to="/features" className="hover:text-teal">Features</Link>
        <Link to="/about" className="hover:text-teal">About</Link>
        <Link to="/contact" className="hover:text-teal">Contact</Link>
      </div>
    </nav>
  );
};

export default Navbar;
