import { GameState, Phase, Role, VerdictChoice, Winner } from "../engine/types";

/**
 * All actions that a client may issue over the WebSocket channel.
 * Each variant is only valid during certain phases and the server enforces that
 * the authenticated socket/player IDs match the payload.
 */
export type ClientMessage =
  /** Create a fresh lobby and seed a host player (lobby only). */
  | { type: "CREATE_GAME"; payload: { accountId: string; name: string; minPlayers?: number } }
  /** Join an existing lobby prior to start. */
  | { type: "JOIN_GAME"; payload: { gameId: string; accountId: string; name: string } }
  /** Host-only action that kicks off role assignment and the first night. */
  | { type: "START_GAME"; payload: { gameId: string; playerId: string } }
  /** Leave the lobby (if pre-game) or mark yourself disconnected (in-game). */
  | { type: "LEAVE_GAME"; payload: { gameId: string; playerId: string } }
  /** Traitor-only action during NIGHT selecting a target to kill. */
  | { type: "NIGHT_VOTE"; payload: { gameId: string; playerId: string; targetId: string } }
  /** Living player nomination during DAY_DISCUSSION. */
  | { type: "DAY_NOMINATE"; payload: { gameId: string; playerId: string; targetId: string } }
  /** Accused-only chat message while on trial. */
  | { type: "TRIAL_CHAT"; payload: { gameId: string; playerId: string; text: string } }
  /** Living player verdict vote (HANG/SPARE) during DAY_VERDICT. */
  | { type: "DAY_VERDICT_VOTE"; payload: { gameId: string; playerId: string; choice: VerdictChoice } };

/** Public info exposed to every viewer, with all secret info stripped. */
export interface PublicPlayerView {
  playerId: string;
  name: string;
  alive: boolean;
  connected: boolean;
  isHost: boolean;
}

/** A player's private view extends the public shape with hidden role info. */
export interface SelfPlayerView extends PublicPlayerView {
  role: Role;
}

/** Sanitized game snapshot tailored for a specific viewer. */
export interface GameView {
  gameId: string;
  phase: Phase;
  dayNumber: number;
  nightNumber: number;
  accusedId: string | null;
  lastKilledId: string | null;
  phaseEndsAt: number;
  winner: Winner | null;
  players: PublicPlayerView[];
  you: SelfPlayerView;
}

/**
 * Builds a per-player view by redacting hidden information and ensuring the caller is part of the game.
 * Roles are only revealed for the viewer; all other players stay anonymous.
 */
export function buildGameView(game: GameState, viewerId: string): GameView {
  const viewer = game.players.find(p => p.playerId === viewerId);
  if (!viewer) {
    throw new Error("Viewer is not part of the game");
  }

  const publicPlayers: PublicPlayerView[] = game.players.map(p => ({
    playerId: p.playerId,
    name: p.name,
    alive: p.alive,
    connected: p.connected,
    isHost: p.isHost
  }));

  const you: SelfPlayerView = {
    playerId: viewer.playerId,
    name: viewer.name,
    alive: viewer.alive,
    connected: viewer.connected,
    isHost: viewer.isHost,
    role: viewer.role
  };

  return {
    gameId: game.gameId,
    phase: game.phase,
    dayNumber: game.dayNumber,
    nightNumber: game.nightNumber,
    accusedId: game.accusedId,
    lastKilledId: game.lastKilledId,
    phaseEndsAt: game.phaseEndsAt,
    winner: game.winner,
    players: publicPlayers,
    you
  };
}

/**
 * Messages emitted by the server. Every payload includes a sanitized GameView unless the
 * event is informational (ERROR / TRIAL_CHAT).
 */
export type ServerMessage =
  | { type: "ERROR"; payload: { code: string; message: string } }
  | { type: "GAME_CREATED"; payload: { game: GameView; playerId: string } }
  | { type: "PLAYER_JOINED"; payload: { game: GameView; playerId: string } }
  | { type: "GAME_STATE"; payload: { game: GameView } }
  | { type: "TRIAL_CHAT"; payload: { gameId: string; playerId: string; text: string; timestamp: number } };
