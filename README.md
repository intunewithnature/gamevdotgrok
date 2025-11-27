# Impious Werewolf Engine

A server-only Werewolf/Mafia backend for [impious.io](https://impious.io). The codebase pairs a functional TypeScript engine with an imperative Express + `ws` shell. State is stored in-memory, and every client interaction flows through WebSockets.

## Quickstart

```bash
npm install          # install dependencies
npm run dev          # start HTTP + WS server with hot reload
npm run test         # execute deterministic Vitest suite
```

The dev server listens on `PORT` (default `3000`). Health probes live at `GET /health`, while `GET /games/:id` exposes raw game state for debugging only.

## Architecture at a Glance

- `src/engine/` – Pure domain logic and transitions. No I/O, no clocks; callers pass timestamps/RNG explicitly.
- `src/server/` – Express app, WebSocket gateway, phase timers, and the in-memory `GameStore`.
- `src/shared/` – Client/server message contracts plus `buildGameView`, which redacts hidden roles per viewer.
- `tests/` – Vitest specs targeting win conditions, transitions, voting edge cases, and parity scenarios.
- `docs/engine.md` – Detailed phase flow, invariants, and API reference for the engine core.
- `docs/protocol.md` – WebSocket message contracts and phase-aware chat policy.

### Chat Protocol

The lobby/day/night chat rules (who can speak, which channel is used, and who hears it)
are enforced solely by the WebSocket layer. See `docs/protocol.md` for the canonical
matrix of allowed speakers plus the `CHAT` vs `TRIAL_CHAT` message formats.

## Developing Features Safely

1. Treat `GameState` snapshots as immutable. Every transition returns a cloned copy that the server then persists.
2. Use `GameRuleError` to communicate invalid actions (wrong phase, double votes, etc.); the WebSocket gateway forwards these as structured `ERROR` messages.
3. Keep new behavior deterministic by threading timestamps and RNG functions through transitions.
4. Update `docs/engine.md` whenever you alter phase flows or invariants so client engineers stay in sync.
