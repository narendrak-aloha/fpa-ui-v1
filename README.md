# FP&A Re-Forecast Copilot — UI

## Run

Requires Node.js 20.19+ or 22.12+, npm and the API Docker stack. Keep the
`api/` and `ui/` repositories in sibling directories.

Start the backend in one terminal:

```bash
cd ../api
cp .env.example .env
docker compose --env-file .env -f docker/docker-compose.yml up --build
```

Wait for `==> API on http://localhost:8000`. In another terminal, from `ui/`:

```bash
npm ci
npm run dev
```

Open http://localhost:8080. Vite proxies API requests to localhost:8000.
Demo login: `test@planner.com` / `Fpa!12345`.

Build the production assets with `npm run build`.

## Documentation

- [Interface usage, architecture and frontend verification](docs/GUIDE.md)
- [Backend startup](../api/README.md)
- [Model provider setup and workflow walkthrough](../api/docs/USAGE.md)
- [Backend architecture and API reference](../api/docs/ARCHITECTURE.md)
- [Approval and workflow states](../api/docs/STATE_FLOWS.md)
- [Backend limitations and verification](../api/docs/DELIVERY.md)
