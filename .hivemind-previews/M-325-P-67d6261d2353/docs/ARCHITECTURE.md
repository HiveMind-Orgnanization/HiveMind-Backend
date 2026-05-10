# Architecture Overview

## System Components
- **Frontend**: React application for user interface.
- **Backend**: Node.js API for handling user registration and email verification.
- **Database**: PostgreSQL for storing user data.

## Data Flow
1. User accesses the sign-up page.
2. User submits registration form.
3. Frontend sends a POST request to the backend API.
4. Backend processes the request, stores user data, and sends a verification email.
5. User verifies email via a link.

## Technologies Used
- **Frontend**: React, Vite
- **Backend**: Node.js, Express
- **Database**: PostgreSQL
- **Authentication**: JWT