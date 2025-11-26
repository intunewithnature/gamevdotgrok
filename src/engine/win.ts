import { GameState, Winner } from "./types";
import { countAlive } from "./utils";

/**
 * Computes the terminal winner (if any) for the supplied state.
 * - Draw when no living players remain.
 * - Subjects win once every traitor is dead.
 * - Traitors win immediately on parity (traitorsAlive >= subjectsAlive).
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
