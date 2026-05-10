# Architecture Overview

## System Components
- **Frontend**: React.js application for user interaction.
- **Backend**: Node.js server handling API requests.
- **Database**: MongoDB for storing user and feature data.

## Data Flows
1. **User Interaction**: Users interact with the frontend, triggering API calls to the backend.
2. **API Requests**: Frontend sends GET requests to retrieve features and POST requests for contact submissions.
3. **Database Operations**: Backend processes requests and interacts with MongoDB to fetch or store data.
