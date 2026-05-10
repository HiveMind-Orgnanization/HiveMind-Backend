import React, { useEffect, useState } from 'react';
import axios from 'axios';

const Dashboard: React.FC = () => {
  const [marketData, setMarketData] = useState([]);

  useEffect(() => {
    const fetchMarketData = async () => {
      const response = await axios.get('/api/market-data');
      setMarketData(response.data);
    };
    fetchMarketData();
  }, []);

  return (
    <div>
      <h1>Dashboard</h1>
      <ul>
        {marketData.map((data: any) => (
          <li key={data.id}>{data.cryptoType}: ${data.currentPrice}</li>
        ))}
      </ul>
    </div>
  );
};

export default Dashboard;