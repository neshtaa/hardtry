
## Important Notes

- The backend includes CORS middleware that allows all origins during development – **restrict in production**.
- Health check endpoint: `GET /health` returns `{"status": "ok"}`.
- The desktop client can be started without a backend; it will use fallback content.
- The game is a single‑player vertical slice – no multiplayer or persistent storage yet.
