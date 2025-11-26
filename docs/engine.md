# Engine Overview

This document describes the alpha v1 Werewolf/Mafia engine that powers impious.io. The engine lives in `src/engine` and is a pure, deterministic state machine. Server layers call exported transitions with explicit timestamps/random seeds and receive updated `GameState` snapshots in return.

## Phase Flow

```
LOBBY --startGame--> NIGHT --resolveNight--> DAY_DISCUSSION --majority--> TRIAL
  ^                                                                 |
  |                                                                 v
  +-- (skip to night) <--- DAY_VERDICT <-- startDayVerdict --- resolveDayVerdict
                                     |                             |
                                     +-------- winner ----------> GAME_OVER
```

- `startGame` assigns roles, jumps into `NIGHT`, and schedules the first timer.
- `resolveNight` either ends the game (if a win condition is met) or advances to `DAY_DISCUSSION`.
- `recordNomination` promotes the phase to `TRIAL` once a strict majority nominates the same target.
- `startDayVerdict` seeds verdict ballots for every living player, and `resolveDayVerdict` either executes the accused, returns to `NIGHT`, or ends the game.
- `skipDayToNight` is invoked when the discussion timer expires without reaching trial.

## Core Invariants

- `rolesAssigned === false` ⇒ `phase === "LOBBY"` (no other phase runs without roles).
- `winner !== null` ⇒ `phase === "GAME_OVER"` and timers are no longer scheduled.
- `phase === "NIGHT"` ⇒ `nightVotes` contains one entry for every living traitor and only they may vote.
- `phase === "DAY_DISCUSSION"` ⇒ `dayNominations` keys represent living players currently talking.
- `phase === "DAY_VERDICT"` ⇒ `verdictVotes` has keys for every living player; votes from dead players are ignored.
- `accusedId !== null` only during `TRIAL` or `DAY_VERDICT`.
- `phaseEndsAt` always holds the absolute timestamp when the server-side timer should resolve the phase.

## Win Rules

Win detection is centralized in `checkWin` (`src/engine/win.ts`). It enforces:

1. Draw when no living players remain.
2. Subjects win once every traitor is dead.
3. Traitors win as soon as traitorsAlive ≥ subjectsAlive (parity or better).

Every transition that can kill a player (`resolveNight`, `resolveDayVerdict`) invokes `checkWin` immediately before advancing the phase.

## Exported Transition API

The server layer primarily calls the following functions from `src/engine/transitions.ts`:

- `createInitialGame(gameId, hostIdentity, overrides?)` – seed a lobby.
- `addPlayerToLobby` / `removePlayerFromLobby` – manage the lobby roster.
- `startGame(now, random?)` – assign roles and enter the first night.
- `startNight(now)` – internal helper used after day resolution/timeouts.
- `recordNightVote(traitorId, targetId)` + `areNightVotesComplete` + `resolveNight(now)` – manage night kills.
- `recordNomination(voterId, targetId, now)` – nominate during day; auto-calls `startTrial` on majority.
- `startTrial(accusedId, now)` → `startDayVerdict(now)` – move through trial/verdict phases.
- `recordVerdictVote(voterId, choice)` + `areAllVerdictVotesIn` + `resolveDayVerdict(now)` – process verdict ballots.
- `skipDayToNight(now)` – timer fallback when no trial happens.
- `setPlayerConnection(playerId, connected)` – update connectivity without mutating phase.

Every function is side-effect free: given the same `GameState`, input IDs, timestamps, and RNG, the output will be identical.
