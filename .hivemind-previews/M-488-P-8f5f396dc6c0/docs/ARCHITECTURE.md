# Architecture

## Overview
The chess game application is a full-stack project consisting of a React frontend and a Node.js backend with MongoDB as the database. The application allows users to play chess against each other or an AI, manage their profiles, and save game progress.

## Frontend
- **Framework**: React
- **Routing**: React Router for page navigation
- **Components**: Home, Game, Login, Profile pages
- **Styling**: CSS with a focus on a clean and responsive design

## Backend
- **Framework**: Express.js
- **Database**: MongoDB for storing user and game data
- **Authentication**: JWT for secure user sessions
- **API Endpoints**:
  - `/api/login`: User authentication
  - `/api/game`: Retrieve game state
  - `/api/move`: Submit a move
  - `/api/save`: Save game progress

## Data Flow
1. **User Authentication**: Users log in via the frontend, which sends credentials to the backend for verification.
2. **Gameplay**: Moves are submitted to the backend, which updates the game state and returns the updated board.
3. **Profile Management**: Users can view and manage their profiles, including game history.