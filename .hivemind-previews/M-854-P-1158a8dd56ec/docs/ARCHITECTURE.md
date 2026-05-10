# Architecture

## Overview
The Ludo game is built as a full-stack application with a React.js frontend and a Node.js backend. The backend uses Express.js for handling API requests and MongoDB for data storage. Real-time gameplay is facilitated using WebSockets.

## Frontend
- **Framework**: React.js
- **Routing**: React Router for navigation between pages.
- **State Management**: React's built-in state management.
- **Build Tool**: Vite for fast development and optimized builds.

### Pages
1. **Home Page**: Landing page with game title and navigation.
2. **Game Lobby**: Interface for joining or creating games.
3. **Game Board**: Main gameplay interface.
4. **Profile Page**: User account management.

## Backend
- **Framework**: Node.js with Express.js
- **Database**: MongoDB for storing user and game data.
- **Authentication**: JWT for secure user sessions.
- **Real-time**: WebSocket for real-time game updates.

### API Endpoints
- `/api/auth/register`: Register a new user.
- `/api/auth/login`: Authenticate user login.
- `/api/games`: Retrieve available games.
- `/api/games/start`: Start a new game.
- `/api/games/move`: Submit a player's move.

## Data Flow
1. **User Registration/Login**: Users register or log in via the frontend, which communicates with the backend API to authenticate and manage sessions.
2. **Game Management**: Users can create or join games, with the backend managing game state and player interactions.
3. **Real-time Updates**: WebSockets are used to push real-time updates to all players in a game.