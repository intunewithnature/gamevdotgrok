import { GameState, Winner } from "./types";
import { countAlive } from "./utils";

/**
 * Determines whether the game has a winner.
 * Traitors win on parity (>= subjects). Draw if everyone dies.
 */
export function checkWin(state: GameState): Winner | null {
  if (state.winner) return state.winner;

  const subjectsAlive = countAlive(state.players, "SUBJECT");
  const traitorsAlive = countAlive(state.players, "TRAITOR");
  const totalAlive = subjectsAlive + traitorsAlive;

  if (totalAlive === 0) return "DRAW";
  if (traitorsAlive === 0) return "SUBJECTS";
  if (traitorsAlive >= subjectsAlive) return "TRAITORS";
  return null;
}
