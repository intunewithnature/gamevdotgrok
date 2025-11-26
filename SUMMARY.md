# Summary

## Engine & Safety Fixes
- Added phase guard that blocks `startNight` from leaving the lobby before roles are assigned and rejects traitors that attempt to vote outside the scheduled night ballot.
- Documented every exported transition/type with TSDoc and clarified shared message contracts, improving discoverability for server/client authors.
- Tightened WebSocket handler docs and store semantics so future maintainers understand which transition is invoked for each client action.

## Documentation
- Rewrote `README.md` with a modern quickstart, architecture overview, and operational notes.
- Added `docs/engine.md`, covering phase flow, invariants, win rules, and the engine API expected by the server shell.

## Tests & Tooling
- Expanded `tests/engine/transitions.test.ts` with parity, tie-breaking, verdict, and guard coverage plus timer edge cases.
- Ensured Vitest suite runs locally (`npm test`) after installing dependencies.
