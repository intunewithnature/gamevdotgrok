import { GameState, Phase, Role, VerdictChoice, Winner } from "../engine/types";

export type ClientMessage =
  | { type: "CREATE_GAME"; payload: { accountId: string; name: string; minPlayers?: number } }
  | { type: "JOIN_GAME"; payload: { gameId: string; accountId: string; name: string } }
  | { type: "START_GAME"; payload: { gameId: string; playerId: string } }
  | { type: "LEAVE_GAME"; payload: { gameId: string; playerId: string } }
  | { type: "NIGHT_VOTE"; payload: { gameId: string; playerId: string; targetId: string } }
  | { type: "DAY_NOMINATE"; payload: { gameId: string; playerId: string; targetId: string } }
  | { type: "TRIAL_CHAT"; payload: { gameId: string; playerId: string; text: string } }
  | { type: "DAY_VERDICT_VOTE"; payload: { gameId: string; playerId: string; choice: VerdictChoice } };

export interface PublicPlayerView {
  playerId: string;
  name: string;
  alive: boolean;
  connected: boolean;
  isHost: boolean;
}

export interface SelfPlayerView extends PublicPlayerView {
  role: Role;
}

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

export type ServerMessage =
  | { type: "ERROR"; payload: { code: string; message: string } }
  | { type: "GAME_CREATED"; payload: { game: GameView; playerId: string } }
  | { type: "PLAYER_JOINED"; payload: { game: GameView; playerId: string } }
  | { type: "GAME_STATE"; payload: { game: GameView } }
  | { type: "TRIAL_CHAT"; payload: { gameId: string; playerId: string; text: string; timestamp: number } };
