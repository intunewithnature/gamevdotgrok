import { GameRuleError, GameState, Player } from "../engine/types";
import { ChatChannel } from "../shared/messages";

export type ChatAudience = "ROOM" | "TRAITORS_ONLY";

export interface ChatRoute {
  channel: ChatChannel;
  audience: ChatAudience;
}

/**
 * Determines which chat channel a player may speak in for the current phase.
 * Throws a GameRuleError when chat is disallowed (e.g. trial for everyone but the accused).
 * The GAME_OVER policy matches DAY chat: everyone can speak via the GAME_OVER channel.
 */
export function resolveChatRoute(game: GameState, sender: Player): ChatRoute {
  switch (game.phase) {
    case "LOBBY":
      return { channel: "LOBBY", audience: "ROOM" };
    case "DAY_DISCUSSION":
    case "DAY_VERDICT":
      if (!sender.alive) {
        throw new GameRuleError("INVALID_CHAT", "Dead players cannot chat during day");
      }
      return { channel: "DAY", audience: "ROOM" };
    case "TRIAL":
      throw new GameRuleError("INVALID_CHAT", "Use TRIAL_CHAT during trial");
    case "NIGHT":
      if (!sender.alive || sender.role !== "TRAITOR") {
        throw new GameRuleError("INVALID_CHAT", "Only living traitors may chat at night");
      }
      return { channel: "NIGHT_TRAITORS", audience: "TRAITORS_ONLY" };
    case "GAME_OVER":
      return { channel: "GAME_OVER", audience: "ROOM" };
    default: {
      const exhaustive: never = game.phase;
      throw new GameRuleError("INVALID_CHAT", `Chat not available during ${exhaustive}`);
    }
  }
}
