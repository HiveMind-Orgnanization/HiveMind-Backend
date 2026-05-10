import React, { useEffect, useState } from 'react';

const Features: React.FC = () => {
  const [features, setFeatures] = useState([]);

  useEffect(() => {
    const fetchFeatures = async () => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/features}`);
      const data = await response.json();
      setFeatures(data);
    };
    fetchFeatures();
  }, []);

  return (
    <div>
      <h1>Features</h1>
      <ul>
        {features.map((feature: any) => (
          <li key={feature.id}>{feature.title}: {feature.description}</li>
        ))}
      </ul>
    </div>
  );
};

export default Features;