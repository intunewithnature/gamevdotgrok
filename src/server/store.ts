import { GameState } from "../engine/types";

export class GameStore {
  private games = new Map<string, GameState>();

  create(game: GameState): GameState {
    if (this.games.has(game.gameId)) {
      throw new Error(`Game ${game.gameId} already exists`);
    }
    this.games.set(game.gameId, game);
    return game;
  }

  get(gameId: string): GameState | undefined {
    return this.games.get(gameId);
  }

  update(gameId: string, game: GameState): GameState {
    if (game.gameId !== gameId) {
      throw new Error("Game ID mismatch");
    }
    this.games.set(gameId, game);
    return game;
  }

  withGame(gameId: string, updater: (current: GameState) => GameState): GameState {
    const current = this.games.get(gameId);
    if (!current) {
      throw new Error(`Game ${gameId} not found`);
    }
    const updated = updater(current);
    this.games.set(gameId, updated);
    return updated;
  }

  delete(gameId: string): void {
    this.games.delete(gameId);
  }

  list(): GameState[] {
    return Array.from(this.games.values());
  }
}
