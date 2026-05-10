# Architecture

## Overview
The Snake game web app is a full-stack application with a React.js frontend and a Node.js/Express backend. The frontend handles the game interface and user interactions, while the backend manages score data storage and retrieval.

## Frontend
- **Framework**: React.js
- **Styling**: Tailwind CSS for responsive design
- **Components**:
  - `Header`: Displays navigation links.
  - `GameBoard`: Manages game state and rendering.
  - `Leaderboard`: Displays top scores.

## Backend
- **Framework**: Node.js with Express
- **Database**: MongoDB for storing scores
- **API Endpoints**:
  - `GET /api/scores`: Retrieve top scores.
  - `POST /api/scores`: Submit a new score.

## Data Flow
1. **Game Interaction**: Users interact with the game via the `GameBoard` component.
2. **Score Submission**: Scores are submitted to the backend via the `POST /api/scores` endpoint.
3. **Leaderboard Display**: The `Leaderboard` component fetches scores from the backend using the `GET /api/scores` endpoint.

## Deployment
- **Frontend**: Deployed on Vercel
- **Backend**: Deployed on Heroku
