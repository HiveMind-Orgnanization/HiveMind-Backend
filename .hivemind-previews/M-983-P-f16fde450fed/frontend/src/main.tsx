import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Game from './pages/Game';
import Instructions from './pages/Instructions';
import './styles.css';

const App = () => (
  <Router basename={import.meta.env.BASE_URL}>
    <Routes>
      <Route path="/game" element={<Game />} />
      <Route path="/instructions" element={<Instructions />} />
    </Routes>
  </Router>
);

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);