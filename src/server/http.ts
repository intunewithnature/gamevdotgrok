import express from "express";
import { GameStore } from "./store";

export function createHttpApp(store: GameStore) {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", games: store.list().length, timestamp: Date.now() });
  });

  app.get("/games/:gameId", (req, res) => {
    const game = store.get(req.params.gameId);
    if (!game) {
      return res.status(404).json({ error: "Game not found" });
    }
    return res.json(game);
  });

  return app;
}
