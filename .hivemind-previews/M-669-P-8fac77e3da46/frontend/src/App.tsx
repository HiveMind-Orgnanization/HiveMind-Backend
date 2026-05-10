import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import TrustSecurity from './components/TrustSecurity';
import Footer from './components/Footer';
import FeaturesPage from './components/FeaturesPage';
import AboutPage from './components/AboutPage';
import ContactPage from './components/ContactPage';
import UserTestimonials from './components/UserTestimonials';

const App: React.FC = () => {
  return (
    <Router basename={import.meta.env.BASE_URL}>
      <div className="bg-dark text-white min-h-screen">
        <Navbar />
        <Routes>
          <Route path="/" element={<>
            <Hero />
            <Features />
            <TrustSecurity />
            <UserTestimonials />
          </>} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Routes>
        <Footer />
      </div>
    </Router>
  );
};

export default App;
