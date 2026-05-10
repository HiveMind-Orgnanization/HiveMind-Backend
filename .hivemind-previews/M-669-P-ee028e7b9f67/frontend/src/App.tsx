import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import Footer from './components/Footer';

const App: React.FC = () => {
  return (
    <Router basename={import.meta.env.BASE_URL}>
      <div className="bg-dark text-white min-h-screen">
        <Navbar />
        <Routes>
          <Route path="/" element={<>
            <Hero />
            <Features />
          </>} />
          {/* Additional routes can be added here */}
        </Routes>
        <Footer />
      </div>
    </Router>
  );
};

export default App;
