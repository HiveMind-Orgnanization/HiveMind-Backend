import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Game from './components/Game';
import Instructions from './components/Instructions';

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/game" element={<Game />} />
      <Route path="/instructions" element={<Instructions />} />
    </Routes>
  );
};

export default App;
