# Chat & Message Protocol

This document extends `docs/engine.md` with the wire protocol for chat. It explains
how the shared message contracts map to game phases and which players are allowed
to speak.

## Client → Server

- `{"type":"CHAT","payload":{"gameId":string,"playerId":string,"text":string}}`  
  The server derives the channel from the current phase and sender role. Whitespace
  is trimmed and the final text must be 1–300 characters.
- `{"type":"TRIAL_CHAT","payload":{"gameId":string,"playerId":string,"text":string}}`  
  Dedicated path for the accused during `TRIAL`. Generic `CHAT` is rejected while
  a trial is in progress.

## Server → Client

- `{"type":"CHAT","payload":{"gameId":string,"playerId":string,"text":string,"channel":ChatChannel,"timestamp":number}}`  
  Broadcast whenever generic chat is allowed. `channel` is one of
  `LOBBY | DAY | NIGHT_TRAITORS | TRIAL | GAME_OVER`. `NIGHT_TRAITORS` payloads are
  only delivered to traitor sockets.
- `{"type":"TRIAL_CHAT","payload":{"gameId":string,"playerId":string,"text":string,"timestamp":number}}`  
  Broadcast to the entire room so everyone can hear the accused during a trial.

## Phase permissions

| Phase              | Who may send           | Channel          | Visibility           | Notes |
|--------------------|------------------------|------------------|----------------------|-------|
| LOBBY              | Any seated player      | `LOBBY`          | Entire room          | Pre-game banter |
| DAY_DISCUSSION     | Living players only    | `DAY`            | Entire room          | Dead players receive but cannot send |
| DAY_VERDICT        | Living players only    | `DAY`            | Entire room          | Same rules as discussion |
| TRIAL              | Accused player only    | `TRIAL_CHAT`     | Entire room          | Generic `CHAT` rejected for everyone |
| NIGHT              | Living traitors only   | `NIGHT_TRAITORS` | Traitors only        | Subjects never see these messages |
| GAME_OVER          | Any player             | `GAME_OVER`      | Entire room          | Post-game lobby chat |

## Policy summary

- `CHAT` is phase- and role-aware. Players do **not** choose channels; the server enforces
  the rules above and drops invalid attempts with `GameRuleError`.
- `TRIAL_CHAT` remains a specialized path so UI can clearly distinguish trial dialogue.
- Night chat visibility is limited to living traitors. Even though dead players can spectate,
  they do not receive traitor whispers to avoid leaking hidden roles.
