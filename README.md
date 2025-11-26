# Impious Werewolf Engine

Server-only Werewolf/Mafia game for impious.io. In-memory, WS-driven, pure engine core.

## Architecture
- **engine/**: Deterministic state machine (types/utils/win/transitions).
- **server/**: Store + HTTP/WS handlers + entrypoint.
- **shared/**: WS message types + views (hides roles/votes).
- **tests/**: Engine units.

## Setup & Run
npm install
npm run dev  # TSX watch
npm run test # Vitest

## WS Workflow
1. Client: CREATE_GAME → Server creates lobby, sends GAME_CREATED.
2. JOIN_GAME → Add to lobby, broadcast PLAYER_JOINED + state.
3. Host: START_GAME → Assign roles, NIGHT phase, schedule timers.
4. NIGHT: Traitors vote → Auto-resolve on complete/timer.
5. DAY: Nominate → Trial if majority → Verdict vote → Resolve/hang/spare.
6. Timers auto-advance; broadcasts per-player views.

Debug: GET /games/:id (raw state).

## Engine Layer (src/engine)
Pure functions: no side effects, deterministic. Input → output, throw GameRuleError for invalids.
