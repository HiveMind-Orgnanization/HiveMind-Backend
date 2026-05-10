import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-dark-blue text-white py-8">
      <div className="max-w-6xl mx-auto px-4 flex justify-between">
        <div>
          <h4 className="font-bold">Contact Us</h4>
          <p>Email: contact@defiprotocol.com</p>
          <p>Follow us on social media:</p>
          <div className="flex space-x-4">
            <a href="#" className="hover:text-teal">Twitter</a>
            <a href="#" className="hover:text-teal">LinkedIn</a>
          </div>
        </div>
        <div className="text-right">
          <p>&copy; 2023 DeFi Protocol. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
