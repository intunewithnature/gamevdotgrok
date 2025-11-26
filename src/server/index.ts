import http from "http";
import { createHttpApp } from "./http";
import { GameStore } from "./store";
import { WebSocketGateway } from "./ws";

// Simple bootstrap that wires the in-memory store to HTTP + WebSocket layers.

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const store = new GameStore();
const app = createHttpApp(store);
const server = http.createServer(app);

const gateway = new WebSocketGateway(store);
gateway.attach(server);

server.listen(PORT, () => {
  console.log(`Werewolf server running on port ${PORT}`);
  console.log("Health check: GET /health");
});
