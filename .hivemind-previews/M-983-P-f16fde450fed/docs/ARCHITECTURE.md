# Architecture

## Overview
This project is a classic Snake game implemented with a React frontend and a Node.js backend. The frontend is responsible for rendering the game UI and handling user interactions, while the backend manages game sessions and scores.

## Frontend
- **Framework:** React with Vite for development and build.
- **Components:**
  - `Game`: Main game interface where the snake moves and food appears.
  - `Instructions`: Displays game controls and rules.
- **Routing:** Implemented using React Router.

## Backend
- **Framework:** Express.js
- **Endpoints:**
  - `GET /api/score`: Retrieves the current score (placeholder for future implementation).

## Data Flow
- User interactions on the frontend trigger state changes and UI updates.
- The backend provides endpoints for retrieving and potentially storing scores.