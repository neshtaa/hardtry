
## Important Notes

- **CORS** – The backend allows all origins during development. Restrict in production.
- **Health check** – `GET /health` returns `{"status": "ok"}`.
- **Fallback data** – If the backend is unreachable, the client uses embedded fallback content.
- **Electron code** – `src/main.ts` and `src/preload.ts` are **not used** in the browser‑first workflow. They are kept for future desktop packaging.
- **No persistent storage** – The current vertical slice does not save progress.
