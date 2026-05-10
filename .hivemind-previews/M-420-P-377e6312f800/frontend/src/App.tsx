import React, { useEffect, useState } from 'react';
import axios from 'axios';

const App: React.FC = () => {
    const [prices, setPrices] = useState([]);
    const [portfolio, setPortfolio] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            const priceResponse = await axios.get('/api/v1/prices');
            const portfolioResponse = await axios.get('/api/v1/portfolio');
            setPrices(priceResponse.data);
            setPortfolio(portfolioResponse.data);
        };
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div>
            <h1>DEX Dashboard</h1>
            <h2>Real-time Prices</h2>
            <ul>{prices.map(price => <li key={price.id}>{price.symbol}: ${price.currentPrice}</li>)}</ul>
            <h2>Your Portfolio</h2>
            {portfolio && <div>Total Value: ${portfolio.totalValue}</div>}
        </div>
    );
};

export default App;
