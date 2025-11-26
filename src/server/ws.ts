import http from "http";
import { randomUUID } from "crypto";
import { WebSocketServer, WebSocket } from "ws";
import { ClientMessage, ServerMessage, buildGameView } from "../shared/messages";
import { GameRuleError, GameState, VerdictChoice } from "../engine/types";
import * as transitions from "../engine/transitions";
import { GameStore } from "./store";

interface ConnectionContext {
  accountId: string;
  playerId: string;
  gameId: string;
}

/** Tracks one timeout per game and executes a callback when the deadline hits. */
class PhaseTimer {
  private timers = new Map<string, NodeJS.Timeout>();

  constructor(private onTimeout: (gameId: string) => void) {}

  schedule(game: GameState): void {
    this.clear(game.gameId);
    if (game.phase === "LOBBY" || game.phase === "GAME_OVER") return;
    const delay = Math.max(0, game.phaseEndsAt - Date.now());
    const timeout = setTimeout(() => this.onTimeout(game.gameId), delay);
    this.timers.set(game.gameId, timeout);
  }

  clear(gameId: string): void {
    const timer = this.timers.get(gameId);
    if (!timer) return;
    clearTimeout(timer);
    this.timers.delete(gameId);
  }
}

/**
 * WebSocket gateway responsible for:
 * - binding sockets to games/players,
 * - routing client messages into engine transitions,
 * - broadcasting per-player game views, and
 * - driving phase timers forward when clients stall.
 */
export class WebSocketGateway {
  private contexts = new Map<WebSocket, ConnectionContext>();
  private rooms = new Map<string, Set<WebSocket>>();
  private timers: PhaseTimer;

  constructor(private store: GameStore) {
    this.timers = new PhaseTimer(gameId => this.onPhaseTimeout(gameId));
  }

  /** Binds the gateway to an HTTP server and starts accepting connections. */
  attach(server: http.Server): void {
    const wss = new WebSocketServer({ server });
    wss.on("connection", socket => {
      socket.on("message", data => this.handleMessage(socket, data.toString()));
      socket.on("close", () => this.handleClose(socket));
      socket.on("error", err => console.error("WebSocket error", err));
    });
  }

  /** Parses an incoming payload and dispatches typed client messages. */
  private handleMessage(socket: WebSocket, raw: string): void {
    try {
      const message: ClientMessage = JSON.parse(raw);
      this.handleClientMessage(socket, message);
    } catch (err) {
      if (err instanceof SyntaxError) {
        this.sendError(socket, "BAD_JSON", "Invalid JSON payload");
      } else if (err instanceof GameRuleError) {
        this.sendError(socket, err.code, err.message);
      } else {
        console.error("Unexpected parse error", err);
        this.sendError(socket, "SERVER_ERROR", "Unexpected error");
      }
    }
  }

  /** Executes the correct handler for the parsed client message. */
  private handleClientMessage(socket: WebSocket, msg: ClientMessage): void {
    try {
      switch (msg.type) {
        case "CREATE_GAME":
          this.handleCreateGame(socket, msg.payload);
          break;
        case "JOIN_GAME":
          this.handleJoinGame(socket, msg.payload);
          break;
        case "START_GAME":
          this.handleStartGame(socket, msg.payload);
          break;
        case "LEAVE_GAME":
          this.handleLeaveGame(socket, msg.payload);
          break;
        case "NIGHT_VOTE":
          this.handleNightVote(socket, msg.payload);
          break;
        case "DAY_NOMINATE":
          this.handleDayNominate(socket, msg.payload);
          break;
        case "TRIAL_CHAT":
          this.handleTrialChat(socket, msg.payload);
          break;
        case "DAY_VERDICT_VOTE":
          this.handleVerdictVote(socket, msg.payload);
          break;
        default:
          this.sendError(socket, "INVALID_TYPE", "Unknown message type");
      }
    } catch (err) {
      if (err instanceof GameRuleError) {
        this.sendError(socket, err.code, err.message);
      } else {
        console.error("Handler error", err);
        this.sendError(socket, "SERVER_ERROR", "Internal error");
      }
    }
  }

  /** Ensures the socket previously joined a game and has an attached identity. */
  private requireContext(socket: WebSocket): ConnectionContext {
    const ctx = this.contexts.get(socket);
    if (!ctx) {
      throw new GameRuleError("NO_CONTEXT", "Socket is not joined to a game");
    }
    return ctx;
  }

  /**
   * Validates that the payload references the same game/player the socket authenticated as,
   * preventing cross-game spoofing.
   */
  private requireValidAction(ctx: ConnectionContext, gameId: string, playerId?: string): void {
    if (ctx.gameId !== gameId) {
      throw new GameRuleError("WRONG_GAME", "Payload references another game");
    }
    if (playerId && ctx.playerId !== playerId) {
      throw new GameRuleError("NOT_YOU", "Cannot act on behalf of another player");
    }
  }

  /** Adds a socket to the per-game room list and stores its context. */
  private attachSocket(socket: WebSocket, ctx: ConnectionContext): void {
    this.contexts.set(socket, ctx);
    const room = this.rooms.get(ctx.gameId) ?? new Set<WebSocket>();
    room.add(socket);
    this.rooms.set(ctx.gameId, room);
  }

  /** Removes socket bookkeeping and marks the player disconnected inside the game state. */
  private detach(socket: WebSocket): void {
    const ctx = this.contexts.get(socket);
    if (!ctx) return;

    this.contexts.delete(socket);
    const room = this.rooms.get(ctx.gameId);
    if (room) {
      room.delete(socket);
      if (room.size === 0) {
        this.rooms.delete(ctx.gameId);
      }
    }

    try {
      const updated = this.store.withGame(ctx.gameId, game =>
        transitions.setPlayerConnection(game, ctx.playerId, false)
      );
      this.broadcastState(updated);
    } catch (err) {
      // Game might already be deleted; swallow quietly
      if (err instanceof Error) {
        console.warn(`Failed to detach socket for game ${ctx.gameId}:`, err.message);
      }
    }
  }

  private handleClose(socket: WebSocket): void {
    this.detach(socket);
  }

  private send(socket: WebSocket, message: ServerMessage): void {
    socket.send(JSON.stringify(message));
  }

  private sendError(socket: WebSocket, code: string, message: string): void {
    this.send(socket, { type: "ERROR", payload: { code, message } });
  }

  private broadcast(gameId: string, message: ServerMessage): void {
    const room = this.rooms.get(gameId);
    if (!room) return;
    for (const socket of room) {
      this.send(socket, message);
    }
  }

  /** Persists and fan-outs the latest state, hydrating per-player views before sending. */
  private broadcastState(game: GameState): void {
    this.store.update(game.gameId, game);
    this.timers.schedule(game);

    const room = this.rooms.get(game.gameId);
    if (!room) return;

    for (const socket of room) {
      const ctx = this.contexts.get(socket);
      if (!ctx) continue;
      try {
        const view = buildGameView(game, ctx.playerId);
        this.send(socket, { type: "GAME_STATE", payload: { game: view } });
      } catch (err) {
        console.error("Failed to build view", err);
      }
    }
  }

  /** Called by PhaseTimer whenever a phase deadline elapses without client input. */
  private onPhaseTimeout(gameId: string): void {
    const game = this.store.get(gameId);
    if (!game) return;

    try {
      const now = Date.now();
      let next: GameState | null = null;
      switch (game.phase) {
        case "NIGHT":
          next = transitions.resolveNight(game, now);
          break;
        case "DAY_DISCUSSION":
          next = transitions.skipDayToNight(game, now);
          break;
        case "TRIAL":
          next = transitions.startDayVerdict(game, now);
          break;
        case "DAY_VERDICT":
          next = transitions.resolveDayVerdict(game, now);
          break;
        default:
          break;
      }
      if (next) {
        this.broadcastState(next);
      }
    } catch (err) {
      console.error("Phase timeout error", err);
    }
  }

  /**
   * CREATE_GAME → seeds a fresh lobby, attaches the socket, and emits GAME_CREATED + GAME_STATE.
   * No prior context is required.
   */
  private handleCreateGame(
    socket: WebSocket,
    payload: { accountId: string; name: string; minPlayers?: number }
  ): void {
    if (this.contexts.has(socket)) {
      throw new GameRuleError("ALREADY_IN_GAME", "Socket already bound to a game");
    }

    const gameId = randomUUID();
    const playerId = randomUUID();
    const identity = { accountId: payload.accountId, playerId, name: payload.name, isHost: true };
    const overrides = payload.minPlayers ? { minPlayers: payload.minPlayers } : undefined;
    const game = transitions.createInitialGame(gameId, identity, overrides);

    this.store.create(game);
    const ctx: ConnectionContext = { accountId: payload.accountId, playerId, gameId };
    this.attachSocket(socket, ctx);

    const view = buildGameView(game, playerId);
    this.send(socket, { type: "GAME_CREATED", payload: { game: view, playerId } });
    this.broadcastState(game);
  }

  /**
   * JOIN_GAME → adds a new player to the lobby and subscribes the socket to future broadcasts.
   */
  private handleJoinGame(
    socket: WebSocket,
    payload: { gameId: string; accountId: string; name: string }
  ): void {
    if (this.contexts.has(socket)) {
      throw new GameRuleError("ALREADY_IN_GAME", "Socket already bound to a game");
    }

    const playerId = randomUUID();
    const identity = { accountId: payload.accountId, playerId, name: payload.name };
    const game = this.store.withGame(payload.gameId, current => transitions.addPlayerToLobby(current, identity));

    const ctx: ConnectionContext = { accountId: payload.accountId, playerId, gameId: payload.gameId };
    this.attachSocket(socket, ctx);

    const view = buildGameView(game, playerId);
    this.send(socket, { type: "PLAYER_JOINED", payload: { game: view, playerId } });
    this.broadcastState(game);
  }

  /**
   * START_GAME → host-only action that transitions the lobby to NIGHT via transitions.startGame.
   */
  private handleStartGame(socket: WebSocket, payload: { gameId: string; playerId: string }): void {
    const ctx = this.requireContext(socket);
    this.requireValidAction(ctx, payload.gameId, payload.playerId);

    const game = this.store.get(payload.gameId);
    if (!game) {
      throw new GameRuleError("GAME_NOT_FOUND", "Game not found");
    }
    const host = game.players.find(p => p.isHost);
    if (!host || host.playerId !== payload.playerId) {
      throw new GameRuleError("NOT_HOST", "Only the host can start the game");
    }

    const next = transitions.startGame(game, Date.now());
    this.broadcastState(next);
  }

  /**
   * NIGHT_VOTE → proxies traitor kill votes to transitions.recordNightVote and resolves immediately on unanimity.
   */
  private handleNightVote(
    socket: WebSocket,
    payload: { gameId: string; playerId: string; targetId: string }
  ): void {
    const ctx = this.requireContext(socket);
    this.requireValidAction(ctx, payload.gameId, payload.playerId);

    const updated = this.store.withGame(payload.gameId, current =>
      transitions.recordNightVote(current, payload.playerId, payload.targetId)
    );
    this.broadcastState(updated);

    if (transitions.areNightVotesComplete(updated)) {
      const resolved = transitions.resolveNight(updated, Date.now());
      this.broadcastState(resolved);
    }
  }

  /**
   * DAY_NOMINATE → writes the player's nomination and lets the engine auto-start a trial on majority.
   */
  private handleDayNominate(
    socket: WebSocket,
    payload: { gameId: string; playerId: string; targetId: string }
  ): void {
    const ctx = this.requireContext(socket);
    this.requireValidAction(ctx, payload.gameId, payload.playerId);

    const updated = this.store.withGame(payload.gameId, current =>
      transitions.recordNomination(current, payload.playerId, payload.targetId, Date.now())
    );
    this.broadcastState(updated);
  }

  /**
   * TRIAL_CHAT → allows only the accused player to speak during a trial; broadcasts to the room.
   */
  private handleTrialChat(
    socket: WebSocket,
    payload: { gameId: string; playerId: string; text: string }
  ): void {
    const ctx = this.requireContext(socket);
    this.requireValidAction(ctx, payload.gameId, payload.playerId);

    const game = this.store.get(payload.gameId);
    if (!game) {
      throw new GameRuleError("GAME_NOT_FOUND", "Game not found");
    }
    if (game.phase !== "TRIAL" || game.accusedId !== payload.playerId) {
      throw new GameRuleError("INVALID_CHAT", "Only the accused may chat during trial");
    }

    const text = payload.text.trim();
    if (text.length === 0 || text.length > 300) {
      throw new GameRuleError("BAD_TEXT", "Trial chat must be 1-300 characters");
    }

    const message: ServerMessage = {
      type: "TRIAL_CHAT",
      payload: { gameId: payload.gameId, playerId: payload.playerId, text, timestamp: Date.now() }
    };
    this.broadcast(payload.gameId, message);
  }

  /**
   * DAY_VERDICT_VOTE → records verdict ballots and auto-resolves once every living voter responded.
   */
  private handleVerdictVote(
    socket: WebSocket,
    payload: { gameId: string; playerId: string; choice: VerdictChoice }
  ): void {
    const ctx = this.requireContext(socket);
    this.requireValidAction(ctx, payload.gameId, payload.playerId);

    const updated = this.store.withGame(payload.gameId, current =>
      transitions.recordVerdictVote(current, payload.playerId, payload.choice)
    );
    this.broadcastState(updated);

    if (transitions.areAllVerdictVotesIn(updated)) {
      const resolved = transitions.resolveDayVerdict(updated, Date.now());
      this.broadcastState(resolved);
    }
  }

  /**
   * LEAVE_GAME → removes the player from the lobby or marks them disconnected mid-match.
   * Also detaches the socket from future broadcasts.
   */
  private handleLeaveGame(socket: WebSocket, payload: { gameId: string; playerId: string }): void {
    const ctx = this.requireContext(socket);
    this.requireValidAction(ctx, payload.gameId, payload.playerId);

    const game = this.store.get(payload.gameId);
    if (!game) {
      throw new GameRuleError("GAME_NOT_FOUND", "Game not found");
    }

    let updated: GameState;
    if (game.phase === "LOBBY") {
      updated = transitions.removePlayerFromLobby(game, payload.playerId);
    } else {
      updated = transitions.setPlayerConnection(game, payload.playerId, false);
    }
    this.broadcastState(updated);
    this.detach(socket);
  }
}
