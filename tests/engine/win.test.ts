import { describe, it, expect } from "vitest";
import { checkWin } from "../../src/engine/win";
import { GameState, Player } from "../../src/engine/types";
import { DEFAULT_GAME_OPTIONS } from "../../src/engine/transitions";

function baseState(players: Player[], winner: GameState["winner"] = null): GameState {
  return {
    gameId: "g",
    players,
    phase: "DAY_DISCUSSION",
    dayNumber: 1,
    nightNumber: 1,
    accusedId: null,
    lastKilledId: null,
    phaseEndsAt: 0,
    winner,
    options: DEFAULT_GAME_OPTIONS,
    rolesAssigned: true,
    nightVotes: {},
    dayNominations: {},
    verdictVotes: {}
  };
}

const subject = (id: string, alive = true): Player => ({
  accountId: id,
  playerId: id,
  name: id,
  role: "SUBJECT",
  alive,
  connected: true,
  isHost: id === "s1"
});

const traitor = (id: string, alive = true): Player => ({
  accountId: id,
  playerId: id,
  name: id,
  role: "TRAITOR",
  alive,
  connected: true,
  isHost: false
});

describe("checkWin", () => {
  it("returns existing winner", () => {
    const state = baseState([], "SUBJECTS");
    expect(checkWin(state)).toBe("SUBJECTS");
  });

  it("detects draw when everyone is dead", () => {
    const state = baseState([]);
    expect(checkWin(state)).toBe("DRAW");
  });

  it("subjects win when traitors are gone", () => {
    const players = [subject("s1"), subject("s2"), traitor("t1", false)];
    expect(checkWin(baseState(players))).toBe("SUBJECTS");
  });

  it("traitors win on parity", () => {
    const players = [subject("s1"), traitor("t1")];
    expect(checkWin(baseState(players))).toBe("TRAITORS");
  });

  it("returns null while both sides alive and subjects lead", () => {
    const players = [subject("s1"), subject("s2"), traitor("t1")];
    expect(checkWin(baseState(players))).toBeNull();
  });
});
