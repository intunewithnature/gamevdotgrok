/**
 * Core domain types for the Werewolf game engine.
 * Keep this file dependency-free so it can be shared across layers.
 */

/** Allegiance assigned to every player. */
export type Role = "SUBJECT" | "TRAITOR";

/** Lifecycle phases the deterministic state machine can be in. */
export type Phase = "LOBBY" | "NIGHT" | "DAY_DISCUSSION" | "TRIAL" | "DAY_VERDICT" | "GAME_OVER";

/** Outcome that permanently ends the game. */
export type Winner = "TRAITORS" | "SUBJECTS" | "DRAW";

/** Binary choice presented during day verdict. */
export type VerdictChoice = "HANG" | "SPARE";

/**
 * Server-side representation of a seated player.
 * The engine never removes players after the lobby; it toggles `alive`/`connected` instead.
 */
export interface Player {
  accountId: string;
  playerId: string;
  name: string;
  role: Role;
  alive: boolean;
  connected: boolean;
  isHost: boolean;
}

/** Minimal identity payload supplied by clients when joining a lobby. */
export interface PlayerIdentity {
  accountId: string;
  playerId: string;
  name: string;
  isHost?: boolean;
}

/** Tunable knobs for balancing and play-testing. */
export interface GameOptions {
  minPlayers: number;
  durations: {
    night: number;
    dayDiscussion: number;
    trial: number;
    dayVerdict: number;
  };
}

/**
 * Immutable snapshot of the entire game world.
 * Key invariants:
 * - `rolesAssigned === false` implies `phase === "LOBBY"`.
 * - `winner !== null` implies `phase === "GAME_OVER"`.
 * - Vote maps only contain voters that are alive for the relevant phase.
 */
export interface GameState {
  gameId: string;
  players: Player[];
  phase: Phase;
  dayNumber: number;
  nightNumber: number;
  accusedId: string | null;
  lastKilledId: string | null;
  phaseEndsAt: number;
  winner: Winner | null;
  options: GameOptions;
  rolesAssigned: boolean;
  nightVotes: Record<string, string | null>; // traitorId -> targetId
  dayNominations: Record<string, string | null>; // voterId -> targetId
  verdictVotes: Record<string, VerdictChoice | null>; // voterId -> choice
}

/** Application-level error for invalid transitions. Surfaces to clients as structured error codes. */
export class GameRuleError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "GameRuleError";
  }
}
