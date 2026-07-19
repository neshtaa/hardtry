
## Important Notes

- **CORS** – The backend allows all origins during development. Restrict in production.
- **Health check** – `GET /health` returns `{"status": "ok"}`.
- **Fallback data** – If the backend is unreachable, the client uses embedded fallback content.
- **Electron code** – `src/main.ts` and `src/preload.ts` are **not used** in the browser‑first workflow. They are kept for future desktop packaging.
- **No persistent storage** – The current vertical slice does not save progress.

## Troubleshooting

### Port 8000 is already in use (backend)
- Change the port:
  ```bash
  uvicorn app.main:app --reload --port 8001
  ```
- Adjust `VITE_API_BASE` accordingly (see Environment Variables above).

### Port 5173 is already in use (Vite)
- Vite will automatically prompt to use the next available port.  
  Accept it, or kill the old process (`lsof -i :5173` on Linux/macOS, `netstat -ano` on Windows).

### Electron window doesn’t open
- The Electron main process is TypeScript and is not compiled by Vite. Open `http://localhost:5173` directly in a browser instead.

### TypeScript / module errors in the console
- Make sure you are inside the `client/` directory when running `npm install` and `npm run dev`.
- Run `npm install` again if dependencies changed.

### “Cannot find module ‘phaser’” or similar
- Run `npm install` inside `client/` first.
