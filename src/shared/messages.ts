import { GameState, Phase, Role, VerdictChoice, Winner } from "../engine/types";

/**
 * Rendered chat streams. TRIAL uses a dedicated TRIAL_CHAT payload but is listed
 * here for clarity so clients can present a consistent set of channels.
 *
 * - LOBBY: everyone pre-game via CHAT.
 * - DAY: living players during DAY_DISCUSSION or DAY_VERDICT via CHAT.
 * - NIGHT_TRAITORS: living traitors at night via CHAT (traitor-only visibility).
 * - TRIAL: accused-only via TRIAL_CHAT (generic CHAT is rejected during trials).
 * - GAME_OVER: post-game lobby via CHAT (current policy: everyone may talk).
 */
export type ChatChannel = "LOBBY" | "DAY" | "NIGHT_TRAITORS" | "TRIAL" | "GAME_OVER";

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
  /**
   * Phase-aware chat routed by the server. The sender never specifies the channel;
   * it is derived from the current phase and the sender's role/status.
   */
  | { type: "CHAT"; payload: { gameId: string; playerId: string; text: string } }
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
 * Messages emitted by the server. GAME_STATE events include a per-player GameView.
 * CHAT carries phase-aware conversations while TRIAL_CHAT remains a dedicated stream
 * for the accused during TRIAL.
 */
export type ServerMessage =
  | { type: "ERROR"; payload: { code: string; message: string } }
  | { type: "GAME_CREATED"; payload: { game: GameView; playerId: string } }
  | { type: "PLAYER_JOINED"; payload: { game: GameView; playerId: string } }
  | { type: "GAME_STATE"; payload: { game: GameView } }
  | { type: "CHAT"; payload: { gameId: string; playerId: string; text: string; channel: ChatChannel; timestamp: number } }
  | { type: "TRIAL_CHAT"; payload: { gameId: string; playerId: string; text: string; timestamp: number } };
