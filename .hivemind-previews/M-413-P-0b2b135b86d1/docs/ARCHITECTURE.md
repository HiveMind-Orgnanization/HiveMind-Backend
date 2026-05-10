# Architecture Overview

## Frontend Structure
The frontend is built using React and consists of the following components:
- **Header**: Contains navigation links.
- **Footer**: Contains links to other pages.
- **Home Page**: Displays game instructions and the start button.
- **Game Page**: Contains the game canvas and controls.
- **Leaderboard Page**: Displays top scores.
- **About Page**: Provides information about the game.

### Data Flow
1. User interacts with the UI.
2. UI components communicate with the backend via API calls.
3. Backend processes requests and interacts with the database.
4. Responses are sent back to the frontend for rendering.

## Deployment
- The frontend is served via a static file server (e.g., Vercel, Netlify).
- The backend is hosted on a Node.js server (e.g., Heroku, AWS).
- MongoDB is used as the database, hosted on MongoDB Atlas.