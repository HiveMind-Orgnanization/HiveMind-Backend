# Snake Game Architecture

## Overview
This document outlines the architecture and data flows for the Snake game.

## Frontend Structure
- **Components:**
  - Game Screen
  - Instructions Page
- **Routing:**
  - `/game`: Main game interface
  - `/instructions`: Gameplay instructions

## Data Flow
1. **Game State Management:**
   - The game state is managed in the frontend using React state.
2. **Score Tracking:**
   - Scores are submitted to the backend for storage and retrieval.

## Deployment
- **Frontend:** Deployed using Vite.
- **Backend:** Node.js and Express server.
- **Database:** MongoDB for storing high scores.