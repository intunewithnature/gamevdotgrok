/**
 * Core domain types for the Werewolf game engine.
 * Keep this file dependency-free so it can be shared across layers.
 */

export type Role = "SUBJECT" | "TRAITOR";
export type Phase = "LOBBY" | "NIGHT" | "DAY_DISCUSSION" | "TRIAL" | "DAY_VERDICT" | "GAME_OVER";
export type Winner = "TRAITORS" | "SUBJECTS" | "DRAW";
export type VerdictChoice = "HANG" | "SPARE";

export interface Player {
  accountId: string;
  playerId: string;
  name: string;
  role: Role;
  alive: boolean;
  connected: boolean;
  isHost: boolean;
}

export interface PlayerIdentity {
  accountId: string;
  playerId: string;
  name: string;
  isHost?: boolean;
}

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
 * All transitions must clone before mutating, ensuring determinism.
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

export class GameRuleError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "GameRuleError";
  }
}
