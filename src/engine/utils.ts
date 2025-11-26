/** Utility helpers shared across engine modules. */
import { GameRuleError, Player, Role } from "./types";

export type RandomFn = () => number;

/** Default RNG, override in tests for determinism. */
export const defaultRandom: RandomFn = () => Math.random();

/** Wall-clock helper for transitions. */
export const nowMs = () => Date.now();

/** Fisher-Yates shuffle (pure). */
export function shuffle<T>(items: readonly T[], random: RandomFn = defaultRandom): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Picks a random element, throwing on empty lists. */
export function randomItem<T>(items: readonly T[], random: RandomFn = defaultRandom): T {
  if (items.length === 0) {
    throw new GameRuleError("EMPTY_SELECTION", "Cannot select from empty list");
  }
  return items[Math.floor(random() * items.length)];
}

/** Deep clone players list (shallow per player). */
export function clonePlayers(players: Player[]): Player[] {
  return players.map(player => ({ ...player }));
}

/** Counts alive players, optionally filtered by role. */
export function countAlive(players: Player[], role?: Role): number {
  return players.filter(p => p.alive && (!role || p.role === role)).length;
}

/** Returns only the living players. */
export function livingPlayers(players: Player[]): Player[] {
  return players.filter(p => p.alive);
}

/** Strict majority threshold: floor(n/2) + 1. */
export function majorityThreshold(aliveCount: number): number {
  return Math.floor(aliveCount / 2) + 1;
}

/** Safe player lookup, null when missing. */
export function getPlayer(players: Player[], playerId: string): Player | null {
  return players.find(p => p.playerId === playerId) ?? null;
}
