import express from "express";
import { GameStore } from "./store";

/**
 * Minimal Express app exposing health/debug endpoints.
 * All gameplay happens over WebSockets; these routes are intentionally tiny.
 */
export function createHttpApp(store: GameStore) {
  const app = express();
  app.use(express.json());

  /** Health probe for load balancers / ops. Returns process stats only. */
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", games: store.list().length, timestamp: Date.now() });
  });

  /**
   * Debug-only endpoint that dumps the raw GameState.
   * Do not expose publicly without authentication; it leaks secret roles.
   */
  app.get("/games/:gameId", (req, res) => {
    const game = store.get(req.params.gameId);
    if (!game) {
      return res.status(404).json({ error: "Game not found" });
    }
    return res.json(game);
  });

  return app;
}
