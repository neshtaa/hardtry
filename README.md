# Wormix‑Like – 2D Turn‑Based Artillery Game

## Overview

Original 2D turn‑based artillery game built with Electron + Phaser (desktop client) and FastAPI (backend). Content‑first architecture with structured data files.

## Prerequisites

- Node.js **20+** (LTS recommended)
- Python **3.11+** (3.10 should also work)
- npm (comes with Node.js)
- A graphical environment (for the Electron window; see troubleshooting for headless setups)

## Setup & Run

### 1. Backend (FastAPI)

The game client fetches weapons, unit classes, and missions from the backend.  
If the backend is not running, the client will use hardcoded fallback data (still playable).

