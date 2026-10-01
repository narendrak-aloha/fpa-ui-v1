# FP&A Re-Forecast Copilot — Frontend

## Start the backend

Keep `api/` and `ui/` next to each other. Complete the backend
[prerequisites](../api/docs/COMMANDS.md#prerequisites), then run from `ui/`:

```bash
cd ../api                # Open the backend repository.
make env                 # Create the local configuration file.
make docker-local-run    # Set up and start the backend.
```

Wait for `==> API on http://localhost:8000`.

## Start the frontend

Requires Node.js 20.19+ or 22.12+ and npm. In a second terminal, from `ui/`:

```bash
npm ci                   # Install the frontend dependencies.
npm run dev              # Start the frontend at http://localhost:8080.
```

Open http://localhost:8080 and sign in with `test@planner.com` / `Fpa!12345`.
Ctrl+C stops the frontend. Stop the backend with `make docker-local-stop` from `api/`.

## Useful commands

Run these from `ui/`:

```bash
npm run build            # Build the production assets.
npm run preview          # Preview the built frontend; requires a running API.
node --test tests/*.test.js  # Run the frontend checks.
```

## Documentation

- [Interface usage and developer guide](docs/GUIDE.md)
- [Backend setup and commands](../api/README.md)
- [All Make commands, briefly explained](../api/docs/COMMANDS.md)
- [Model provider setup](../api/docs/USAGE.md)
- [Architecture and API reference](../api/docs/ARCHITECTURE.md)
- [Approval and workflow states](../api/docs/STATE_FLOWS.md)
- [Limitations and verification](../api/docs/DELIVERY.md)
