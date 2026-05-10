# Architecture Overview

## System Components
- **Frontend**: React application for user interface.
- **Backend**: Node.js server for handling authentication and password recovery.
- **Database**: PostgreSQL for user data storage.

## Data Flow
1. User submits login form.
2. Frontend sends POST request to `/api/login` with credentials.
3. Backend validates credentials and returns a JWT token if successful.
4. User can initiate password recovery via `/api/recover-password`.
5. User data is stored and retrieved from PostgreSQL.