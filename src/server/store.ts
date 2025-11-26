import { GameState } from "../engine/types";

/**
 * Extremely small in-memory game registry.
 * The HTTP and WS layers both treat it as the single source of truth per process.
 */
export class GameStore {
  private games = new Map<string, GameState>();

  /** Inserts a brand new game, throwing if the ID already exists. */
  create(game: GameState): GameState {
    if (this.games.has(game.gameId)) {
      throw new Error(`Game ${game.gameId} already exists`);
    }
    this.games.set(game.gameId, game);
    return game;
  }

  /** Fetches a game by ID or undefined when missing. */
  get(gameId: string): GameState | undefined {
    return this.games.get(gameId);
  }

  /** Blindly replaces the stored snapshot after asserting the IDs match. */
  update(gameId: string, game: GameState): GameState {
    if (game.gameId !== gameId) {
      throw new Error("Game ID mismatch");
    }
    this.games.set(gameId, game);
    return game;
  }

  /**
   * Atomically load-modify-store a game snapshot.
   * Since the backing map lives on a single thread it is safe to treat this as a critical section.
   */
  withGame(gameId: string, updater: (current: GameState) => GameState): GameState {
    const current = this.games.get(gameId);
    if (!current) {
      throw new Error(`Game ${gameId} not found`);
    }
    const updated = updater(current);
    this.games.set(gameId, updated);
    return updated;
  }

  /** Removes a game entirely (used when cleaning up finished games). */
  delete(gameId: string): void {
    this.games.delete(gameId);
  }

  /** Returns all games, useful for diagnostics. */
  list(): GameState[] {
    return Array.from(this.games.values());
  }
}
