import { describe, it, expect } from "vitest";
import * as transitions from "../../src/engine/transitions";
import { GameRuleError, GameState, Player } from "../../src/engine/types";

const BASE_OPTIONS = transitions.DEFAULT_GAME_OPTIONS;

const createPlayer = (id: string, role: Player["role"] = "SUBJECT", alive = true): Player => ({
  accountId: id,
  playerId: id,
  name: id,
  role,
  alive,
  connected: true,
  isHost: id === "host"
});

function makeState(partial: Partial<GameState>): GameState {
  return {
    gameId: "game",
    players: [],
    phase: "LOBBY",
    dayNumber: 1,
    nightNumber: 1,
    accusedId: null,
    lastKilledId: null,
    phaseEndsAt: 0,
    winner: null,
    options: BASE_OPTIONS,
    rolesAssigned: true,
    nightVotes: {},
    dayNominations: {},
    verdictVotes: {},
    ...partial
  };
}

describe("transitions lifecycle", () => {
  it("creates initial game with seeded host", () => {
    const game = transitions.createInitialGame("g1", { accountId: "host", playerId: "host", name: "Host" });
    expect(game.phase).toBe("LOBBY");
    expect(game.players).toHaveLength(1);
    expect(game.players[0].isHost).toBe(true);
  });

  it("adds unique players and rejects duplicate accounts", () => {
    let game = transitions.createInitialGame("g", { accountId: "host", playerId: "host", name: "Host" });
    game = transitions.addPlayerToLobby(game, { accountId: "a2", playerId: "p2", name: "P2" });
    expect(game.players).toHaveLength(2);
    expect(() =>
      transitions.addPlayerToLobby(game, { accountId: "host", playerId: "x", name: "Dup" })
    ).toThrowError(GameRuleError);
  });

  it("starts the game once min players met", () => {
    let game = transitions.createInitialGame(
      "g",
      { accountId: "host", playerId: "host", name: "Host" },
      { minPlayers: 3 }
    );
    game = transitions.addPlayerToLobby(game, { accountId: "a2", playerId: "p2", name: "P2" });
    game = transitions.addPlayerToLobby(game, { accountId: "a3", playerId: "p3", name: "P3" });

    const started = transitions.startGame(game, 0, () => 0.1);
    expect(started.phase).toBe("NIGHT");
    expect(started.rolesAssigned).toBe(true);
    expect(Object.keys(started.nightVotes).length).toBeGreaterThanOrEqual(1);
  });
});

describe("night phase", () => {
  const nightGame = () =>
    makeState({
      players: [
        createPlayer("t1", "TRAITOR"),
        createPlayer("s1"),
        createPlayer("s2"),
        createPlayer("s3")
      ],
      phase: "NIGHT",
      nightVotes: { t1: null }
    });

  it("records traitor votes", () => {
    const updated = transitions.recordNightVote(nightGame(), "t1", "s1");
    expect(updated.nightVotes["t1"]).toBe("s1");
  });

  it("completes when all traitors voted", () => {
    const voted = transitions.recordNightVote(nightGame(), "t1", "s1");
    expect(transitions.areNightVotesComplete(voted)).toBe(true);
  });

  it("resolves and advances to day discussion", () => {
    const voted = transitions.recordNightVote(nightGame(), "t1", "s1");
    const resolved = transitions.resolveNight(voted, 1000, () => 0);
    expect(resolved.phase).toBe("DAY_DISCUSSION");
    expect(resolved.lastKilledId).toBe("s1");
    expect(resolved.dayNumber).toBe(2);
  });

  it("rejects night votes from players not scheduled to vote", () => {
    const badState = makeState({
      players: [createPlayer("t1", "TRAITOR"), createPlayer("s1")],
      phase: "NIGHT",
      nightVotes: {}
    });
    expect(() => transitions.recordNightVote(badState, "t1", "s1")).toThrowError(GameRuleError);
  });

  it("breaks night vote ties using supplied RNG", () => {
    const base = makeState({
      players: [
        createPlayer("t1", "TRAITOR"),
        createPlayer("t2", "TRAITOR"),
        createPlayer("s1"),
        createPlayer("s2")
      ],
      phase: "NIGHT",
      nightVotes: { t1: "s1", t2: "s2" }
    });
    const resolved = transitions.resolveNight(base, 500, () => 0.9);
    expect(resolved.lastKilledId).toBe("s2");
  });

  it("ignores votes that reference already-dead targets", () => {
    const base = makeState({
      players: [createPlayer("t1", "TRAITOR"), { ...createPlayer("s1"), alive: false }],
      phase: "NIGHT",
      nightVotes: { t1: "s1" }
    });
    const resolved = transitions.resolveNight(base, 123);
    expect(resolved.lastKilledId).toBeNull();
  });
});

describe("day and verdict phases", () => {
  const dayGame = () =>
    makeState({
      players: [createPlayer("p1"), createPlayer("p2"), createPlayer("p3")],
      phase: "DAY_DISCUSSION",
      dayNominations: {}
    });

  it("starts trial once nominations reach majority", () => {
    let game = dayGame();
    game = transitions.recordNomination(game, "p1", "p3", 0);
    game = transitions.recordNomination(game, "p2", "p3", 0);
    expect(game.phase).toBe("TRIAL");
    expect(game.accusedId).toBe("p3");
  });

  it("creates verdict ballots for all living players", () => {
    const trial = transitions.startTrial(dayGame(), "p1", 0);
    const verdict = transitions.startDayVerdict(trial, 0);
    expect(verdict.phase).toBe("DAY_VERDICT");
    expect(Object.values(verdict.verdictVotes)).toHaveLength(3);
  });

  it("hangs accused when hang votes beat spare", () => {
    let verdictGame = makeState({
      players: [createPlayer("p1"), createPlayer("p2"), createPlayer("p3", "TRAITOR")],
      phase: "DAY_VERDICT",
      accusedId: "p3",
      verdictVotes: { p1: "HANG", p2: "HANG", p3: "SPARE" }
    });

    const resolved = transitions.resolveDayVerdict(verdictGame, 0);
    expect(resolved.lastKilledId).toBe("p3");
    expect(["NIGHT", "GAME_OVER"]).toContain(resolved.phase);
  });

  it("ties spare the accused", () => {
    const verdictGame = makeState({
      players: [createPlayer("p1"), createPlayer("p2"), createPlayer("p3")],
      phase: "DAY_VERDICT",
      accusedId: "p3",
      verdictVotes: { p1: "HANG", p2: "SPARE", p3: null }
    });
    const resolved = transitions.resolveDayVerdict(verdictGame, 0);
    expect(resolved.players.find(p => p.playerId === "p3")?.alive).toBe(true);
  });

  it("immediately ends the game when the last traitor is hanged", () => {
    const verdictGame = makeState({
      players: [createPlayer("s1"), createPlayer("s2"), createPlayer("t1", "TRAITOR")],
      phase: "DAY_VERDICT",
      accusedId: "t1",
      verdictVotes: { s1: "HANG", s2: "HANG", t1: "SPARE" }
    });
    const resolved = transitions.resolveDayVerdict(verdictGame, 0);
    expect(resolved.phase).toBe("GAME_OVER");
    expect(resolved.winner).toBe("SUBJECTS");
  });

  it("ignores null votes from disconnected players when resolving", () => {
    const verdictGame = makeState({
      players: [
        createPlayer("p1"),
        { ...createPlayer("p2"), connected: false },
        createPlayer("p3")
      ],
      phase: "DAY_VERDICT",
      accusedId: "p3",
      verdictVotes: { p1: "HANG", p2: null, p3: "SPARE" }
    });
    const resolved = transitions.resolveDayVerdict(verdictGame, 0);
    expect(resolved.players.find(p => p.playerId === "p3")?.alive).toBe(true);
  });

  it("detects when not all verdict votes are in", () => {
    const verdictGame = makeState({
      players: [createPlayer("p1"), createPlayer("p2")],
      phase: "DAY_VERDICT",
      accusedId: "p2",
      verdictVotes: { p1: "HANG", p2: null }
    });
    expect(transitions.areAllVerdictVotesIn(verdictGame)).toBe(false);
  });
});

describe("utility transitions", () => {
  it("skips day to night", () => {
    const game = transitions.skipDayToNight(
      makeState({ phase: "DAY_DISCUSSION", players: [createPlayer("p1")] }),
      0
    );
    expect(game.phase).toBe("NIGHT");
  });

  it("marks player as disconnected", () => {
    const game = transitions.setPlayerConnection(
      makeState({ players: [createPlayer("p1")] }),
      "p1",
      false
    );
    expect(game.players[0].connected).toBe(false);
  });

  it("prevents night from starting before roles are assigned", () => {
    const lobby = transitions.createInitialGame("g", {
      accountId: "host",
      playerId: "host",
      name: "Host"
    });
    expect(() => transitions.startNight(lobby, 0)).toThrowError(GameRuleError);
  });
});
