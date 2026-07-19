# Wormix‑Like – 2D Turn‑Based Artillery Game

## Overview

Original 2D turn‑based artillery game built with Electron + Phaser (desktop client) and FastAPI (backend). Content‑first architecture with structured data files.

## Prerequisites

- Node.js 20+
- Python 3.11+
- Docker (optional for containerized setup)

## Setup

### Backend (Python FastAPI)

1. Navigate to the `backend/` directory:

   ```bash
   cd backend
   ```

2. Create a virtual environment (optional but recommended):

   ```bash
   python -m venv venv
   source venv/bin/activate   # Windows: venv\Scripts\activate
   ```

3. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

4. Start the development server:

   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

   The API will be available at `http://localhost:8000`.

### Frontend (Electron + Phaser Client) – *Desktop‑only*

The game client is a standalone Electron application using Phaser for rendering.

1. Navigate to the `client/` directory:

   ```bash
   cd client
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server (Vite + Electron):

   ```bash
   npm run dev
   ```

   This runs Vite on port `5173` and launches an Electron window that loads the game.

   The game starts with a **mission selection screen**. Press the number key (1, 2, …) to choose a mission.  
   After selecting, press **SPACE** to start the battle. During a battle, press **SPACE** to fire.  
   After winning or losing, you can press **R** to replay, **N** to advance to the next mission (if available), or **M** to return to the mission menu.

### Docker (Alternative – Backend only)

For containerized development of the backend, run:

