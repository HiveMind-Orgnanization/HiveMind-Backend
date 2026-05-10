import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import Home from './pages/Home';
import Features from './pages/Features';
import Contact from './pages/Contact';

const App: React.FC = () => {
  return (
    <Router>
      <Switch>
        <Route path="/" exact component={Home} />
        <Route path="/features" component={Features} />
        <Route path="/contact" component={Contact} />
      </Switch>
    </Router>
  );
};

export default App;