import { describe, expect, it } from "vitest";
import { resolveChatRoute } from "../../src/server/chat";
import { GameState, Player } from "../../src/engine/types";

const defaultOptions = {
  minPlayers: 5,
  durations: { night: 1000, dayDiscussion: 1000, trial: 1000, dayVerdict: 1000 }
};

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    accountId: overrides.accountId ?? "account-" + (overrides.playerId ?? "p"),
    playerId: overrides.playerId ?? "player",
    name: overrides.name ?? "Player",
    role: overrides.role ?? "SUBJECT",
    alive: overrides.alive ?? true,
    connected: overrides.connected ?? true,
    isHost: overrides.isHost ?? false
  };
}

function makeGame(overrides: Partial<GameState> = {}): GameState {
  return {
    gameId: overrides.gameId ?? "game",
    players:
      overrides.players ??
      [
        makePlayer({ playerId: "subject", role: "SUBJECT" }),
        makePlayer({ playerId: "traitor", role: "TRAITOR" })
      ],
    phase: overrides.phase ?? "LOBBY",
    dayNumber: overrides.dayNumber ?? 1,
    nightNumber: overrides.nightNumber ?? 1,
    accusedId: overrides.accusedId ?? null,
    lastKilledId: overrides.lastKilledId ?? null,
    phaseEndsAt: overrides.phaseEndsAt ?? Date.now() + 1000,
    winner: overrides.winner ?? null,
    options: overrides.options ?? defaultOptions,
    rolesAssigned: overrides.rolesAssigned ?? true,
    nightVotes: overrides.nightVotes ?? {},
    dayNominations: overrides.dayNominations ?? {},
    verdictVotes: overrides.verdictVotes ?? {}
  };
}

describe("resolveChatRoute", () => {
  it("allows any lobby player to chat", () => {
    const game = makeGame({ phase: "LOBBY" });
    const route = resolveChatRoute(game, game.players[0]);
    expect(route).toEqual({ channel: "LOBBY", audience: "ROOM" });
  });

  it("allows only living players to chat during day phases", () => {
    const living = makePlayer({ playerId: "alive", role: "SUBJECT", alive: true });
    const dead = makePlayer({ playerId: "dead", role: "SUBJECT", alive: false });
    const game = makeGame({ phase: "DAY_DISCUSSION", players: [living, dead] });
    expect(resolveChatRoute(game, living)).toEqual({ channel: "DAY", audience: "ROOM" });
    expect(() => resolveChatRoute(game, dead)).toThrowError(/Dead players/);
  });

  it("rejects generic chat during trials", () => {
    const accused = makePlayer({ playerId: "accused", role: "SUBJECT" });
    const game = makeGame({ phase: "TRIAL", players: [accused], accusedId: "accused" });
    expect(() => resolveChatRoute(game, accused)).toThrowError(/TRIAL_CHAT/);
  });

  it("allows only living traitors to use night chat", () => {
    const traitor = makePlayer({ playerId: "traitor", role: "TRAITOR", alive: true });
    const deadTraitor = makePlayer({ playerId: "deadTraitor", role: "TRAITOR", alive: false });
    const subject = makePlayer({ playerId: "subject", role: "SUBJECT", alive: true });
    const game = makeGame({ phase: "NIGHT", players: [traitor, subject, deadTraitor] });

    expect(resolveChatRoute(game, traitor)).toEqual({ channel: "NIGHT_TRAITORS", audience: "TRAITORS_ONLY" });
    expect(() => resolveChatRoute(game, subject)).toThrowError(/Only living traitors/);
    expect(() => resolveChatRoute(game, deadTraitor)).toThrowError(/Only living traitors/);
  });

  it("opens chat to everyone after the game ends", () => {
    const player = makePlayer({ playerId: "spectator" });
    const game = makeGame({ phase: "GAME_OVER", players: [player], winner: "TRAITORS" });
    expect(resolveChatRoute(game, player)).toEqual({ channel: "GAME_OVER", audience: "ROOM" });
  });
});
