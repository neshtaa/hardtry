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

### Frontend (React + Vite)

1. Navigate to the `frontend/` directory:

   ```bash
   cd frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

   The UI will be available at `http://localhost:5173`.

### Docker (Alternative)

For containerized development, run:

