# Architecture Overview

## System Architecture
The DEX dashboard consists of a frontend application built with React.js and a backend API developed using Node.js. The frontend communicates with the backend to fetch real-time data and user portfolio information.

## Data Flow
1. **User Authentication**: Users log in using JWT, which is validated by the backend.
2. **Data Fetching**: The frontend makes API calls to retrieve:
   - Real-time prices from `/api/v1/prices`
   - User portfolio data from `/api/v1/portfolio`
   - Historical trading volume from `/api/v1/trading-volume`
3. **Data Presentation**: The frontend displays the fetched data in a user-friendly dashboard layout.

## Components
- **Frontend**: React.js application with components for displaying market data, portfolio overview, and charts.
- **Backend**: Node.js server with Express.js handling API requests and MongoDB for data storage.