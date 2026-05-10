import React from 'react';

const Trade: React.FC = () => {
  return (
    <div>
      <h1>Trade Cryptocurrency</h1>
      <form>
        <input type='text' placeholder='Cryptocurrency' />
        <input type='number' placeholder='Amount' />
        <button type='submit'>Buy/Sell</button>
      </form>
    </div>
  );
};

export default Trade;