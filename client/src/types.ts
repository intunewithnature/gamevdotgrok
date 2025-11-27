// --- From src/engine/types.ts ---

export type Role = "SUBJECT" | "TRAITOR";
export type Phase = "LOBBY" | "NIGHT" | "DAY_DISCUSSION" | "TRIAL" | "DAY_VERDICT" | "GAME_OVER";
export type Winner = "TRAITORS" | "SUBJECTS" | "DRAW";
export type VerdictChoice = "HANG" | "SPARE";

// --- From src/shared/messages.ts ---

export type ChatChannel = "LOBBY" | "DAY" | "NIGHT_TRAITORS" | "TRIAL" | "GAME_OVER";

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

export type ClientMessage =
  | { type: "CREATE_GAME"; payload: { accountId: string; name: string; minPlayers?: number } }
  | { type: "JOIN_GAME"; payload: { gameId: string; accountId: string; name: string } }
  | { type: "START_GAME"; payload: { gameId: string; playerId: string } }
  | { type: "LEAVE_GAME"; payload: { gameId: string; playerId: string } }
  | { type: "NIGHT_VOTE"; payload: { gameId: string; playerId: string; targetId: string } }
  | { type: "DAY_NOMINATE"; payload: { gameId: string; playerId: string; targetId: string } }
  | { type: "TRIAL_CHAT"; payload: { gameId: string; playerId: string; text: string } }
  | { type: "CHAT"; payload: { gameId: string; playerId: string; text: string } }
  | { type: "DAY_VERDICT_VOTE"; payload: { gameId: string; playerId: string; choice: VerdictChoice } }
  | { type: "DEBUG_POPULATE_LOBBY"; payload: { gameId: string; playerId: string; totalPlayers?: number } }
  | { type: "DEBUG_FORCE_TIMEOUT"; payload: { gameId: string; playerId: string } };

export type ServerMessage =
  | { type: "ERROR"; payload: { code: string; message: string } }
  | { type: "GAME_CREATED"; payload: { game: GameView; playerId: string } }
  | { type: "PLAYER_JOINED"; payload: { game: GameView; playerId: string } }
  | { type: "GAME_STATE"; payload: { game: GameView } }
  | { type: "CHAT"; payload: { gameId: string; playerId: string; text: string; channel: ChatChannel; timestamp: number } }
  | { type: "TRIAL_CHAT"; payload: { gameId: string; playerId: string; text: string; timestamp: number } };

// Helper to keep track of chat in UI
export interface ChatMessageDisplay {
  id: string;
  senderId: string;
  text: string;
  channel: ChatChannel;
  timestamp: number;
}
