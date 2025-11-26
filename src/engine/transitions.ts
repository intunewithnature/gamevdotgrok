import {
  GameOptions,
  GameState,
  Phase,
  Player,
  PlayerIdentity,
  VerdictChoice,
  GameRuleError
} from "./types";
import {
  RandomFn,
  defaultRandom,
  shuffle,
  randomItem,
  clonePlayers,
  countAlive,
  livingPlayers,
  majorityThreshold,
  getPlayer
} from "./utils";
import { checkWin } from "./win";

export interface GameOptionsOverrides {
  minPlayers?: number;
  durations?: Partial<GameOptions["durations"]>;
}

export const DEFAULT_GAME_OPTIONS: GameOptions = {
  minPlayers: 6,
  durations: {
    night: 90_000,
    dayDiscussion: 90_000,
    trial: 30_000,
    dayVerdict: 15_000
  }
};

export function mergeOptions(overrides?: GameOptionsOverrides): GameOptions {
  const durations = { ...DEFAULT_GAME_OPTIONS.durations, ...overrides?.durations };
  return { ...DEFAULT_GAME_OPTIONS, ...overrides, durations };
}

export function ensurePhase(game: GameState, expected: Phase | Phase[], message: string): void {
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(game.phase)) {
    throw new GameRuleError("INVALID_PHASE", message);
  }
}

interface AssertOptions {
  mustBeAlive?: boolean;
}

export function assertPlayer(game: GameState, playerId: string, opts: AssertOptions = {}): Player {
  const player = getPlayer(game.players, playerId);
  if (!player) {
    throw new GameRuleError("PLAYER_NOT_FOUND", `Player ${playerId} not found`);
  }
  if (opts.mustBeAlive && !player.alive) {
    throw new GameRuleError("PLAYER_DEAD", `Player ${playerId} is dead`);
  }
  return player;
}

export function toPlayer(identity: PlayerIdentity): Player {
  return {
    accountId: identity.accountId,
    playerId: identity.playerId,
    name: identity.name,
    role: "SUBJECT",
    alive: true,
    connected: true,
    isHost: Boolean(identity.isHost)
  };
}

export function reassignHost(players: Player[]): Player[] {
  if (players.length === 0) return players;
  const hasHost = players.some(p => p.isHost);
  if (hasHost) return players;
  return players.map((player, index) => (index === 0 ? { ...player, isHost: true } : player));
}

export function createInitialGame(
  gameId: string,
  hostIdentity: PlayerIdentity,
  overrides?: GameOptionsOverrides
): GameState {
  const players = [toPlayer({ ...hostIdentity, isHost: true })];
  return {
    gameId,
    players,
    phase: "LOBBY",
    dayNumber: 1,
    nightNumber: 1,
    accusedId: null,
    lastKilledId: null,
    phaseEndsAt: 0,
    winner: null,
    options: mergeOptions(overrides),
    rolesAssigned: false,
    nightVotes: {},
    dayNominations: {},
    verdictVotes: {}
  };
}

export function addPlayerToLobby(game: GameState, identity: PlayerIdentity): GameState {
  ensurePhase(game, "LOBBY", "Players can only join during the lobby phase");
  if (game.players.some(p => p.accountId === identity.accountId)) {
    throw new GameRuleError("DUPLICATE_ACCOUNT", "Account already joined");
  }
  return { ...game, players: [...game.players, toPlayer(identity)] };
}

export function removePlayerFromLobby(game: GameState, playerId: string): GameState {
  ensurePhase(game, "LOBBY", "Players can only leave during the lobby phase");
  assertPlayer(game, playerId);
  const remaining = game.players.filter(p => p.playerId !== playerId);
  return { ...game, players: reassignHost(remaining) };
}

export function assignRoles(game: GameState, random: RandomFn = defaultRandom): GameState {
  ensurePhase(game, "LOBBY", "Roles are assigned from the lobby phase");
  if (game.rolesAssigned) return game;

  const shuffled = shuffle(game.players, random);
  const traitorCount = Math.max(1, Math.floor(shuffled.length / 4));
  const traitors = shuffled.slice(0, traitorCount).map(p => ({ ...p, role: "TRAITOR" as const, alive: true }));
  const subjects = shuffled.slice(traitorCount).map(p => ({ ...p, role: "SUBJECT" as const, alive: true }));
  return { ...game, players: [...traitors, ...subjects], rolesAssigned: true };
}

export function startNight(game: GameState, now: number): GameState {
  const allowed: Phase[] = ["LOBBY", "DAY_DISCUSSION", "DAY_VERDICT"];
  ensurePhase(game, allowed, "Night can only start from lobby or day phases");

  const nightNumber = game.phase === "LOBBY" ? game.nightNumber : game.nightNumber + 1;
  const traitors = livingPlayers(game.players).filter(p => p.role === "TRAITOR");
  const nightVotes = Object.fromEntries(traitors.map(t => [t.playerId, null as string | null]));

  return {
    ...game,
    phase: "NIGHT",
    nightNumber,
    accusedId: null,
    dayNominations: {},
    verdictVotes: {},
    nightVotes,
    phaseEndsAt: now + game.options.durations.night
  };
}

export function startGame(game: GameState, now: number, random: RandomFn = defaultRandom): GameState {
  ensurePhase(game, "LOBBY", "Game can only start in the lobby phase");
  if (game.players.length < game.options.minPlayers) {
    throw new GameRuleError("NOT_ENOUGH_PLAYERS", `Need at least ${game.options.minPlayers} players`);
  }
  const assigned = assignRoles(game, random);
  return startNight(assigned, now);
}

export function recordNightVote(game: GameState, traitorId: string, targetId: string): GameState {
  ensurePhase(game, "NIGHT", "Night votes only apply during the night phase");
  const traitor = assertPlayer(game, traitorId, { mustBeAlive: true });
  if (traitor.role !== "TRAITOR") {
    throw new GameRuleError("NOT_A_TRAITOR", "Only traitors vote at night");
  }
  const target = assertPlayer(game, targetId, { mustBeAlive: true });
  return { ...game, nightVotes: { ...game.nightVotes, [traitor.playerId]: target.playerId } };
}

export function areNightVotesComplete(game: GameState): boolean {
  ensurePhase(game, "NIGHT", "Only check completeness during night");
  const traitorsAlive = countAlive(game.players, "TRAITOR");
  const votes = Object.values(game.nightVotes).filter(Boolean).length;
  return votes === traitorsAlive && traitorsAlive > 0;
}

function tallyVotes(votes: Record<string, string | null>): Map<string, number> {
  const tally = new Map<string, number>();
  for (const target of Object.values(votes)) {
    if (!target) continue;
    tally.set(target, (tally.get(target) ?? 0) + 1);
  }
  return tally;
}

export function resolveNight(game: GameState, now: number, random: RandomFn = defaultRandom): GameState {
  ensurePhase(game, "NIGHT", "Night resolution only runs from the night phase");
  const players = clonePlayers(game.players);
  const votes = tallyVotes(game.nightVotes);
  let killed: string | null = null;

  if (votes.size > 0) {
    const topScore = Math.max(...votes.values());
    const leaders = [...votes.entries()].filter(([, score]) => score === topScore).map(([id]) => id);
    const victimId = leaders.length === 1 ? leaders[0] : randomItem(leaders, random);
    const victim = getPlayer(players, victimId);
    if (victim?.alive) {
      victim.alive = false;
      killed = victim.playerId;
    }
  }

  const baseState: GameState = {
    ...game,
    players,
    lastKilledId: killed,
    nightVotes: {},
    phaseEndsAt: now
  };

  const winner = checkWin(baseState);
  if (winner) {
    return {
      ...baseState,
      phase: "GAME_OVER",
      winner,
      dayNominations: {},
      verdictVotes: {}
    };
  }

  return {
    ...baseState,
    phase: "DAY_DISCUSSION",
    dayNumber: game.dayNumber + 1,
    accusedId: null,
    dayNominations: {},
    verdictVotes: {},
    phaseEndsAt: now + game.options.durations.dayDiscussion
  };
}

export function recordNomination(game: GameState, voterId: string, targetId: string, now: number): GameState {
  ensurePhase(game, "DAY_DISCUSSION", "Nominations only apply during day discussion");
  const voter = assertPlayer(game, voterId, { mustBeAlive: true });
  const target = assertPlayer(game, targetId, { mustBeAlive: true });

  const updated: GameState = {
    ...game,
    dayNominations: { ...game.dayNominations, [voter.playerId]: target.playerId }
  };

  const tally = tallyVotes(updated.dayNominations);
  const alive = livingPlayers(game.players).length;
  const threshold = majorityThreshold(alive);
  const votesForTarget = tally.get(target.playerId) ?? 0;

  if (votesForTarget >= threshold) {
    return startTrial(updated, target.playerId, now);
  }
  return updated;
}

export function startTrial(game: GameState, accusedId: string, now: number): GameState {
  ensurePhase(game, "DAY_DISCUSSION", "Trials start from day discussion");
  assertPlayer(game, accusedId, { mustBeAlive: true });
  return {
    ...game,
    phase: "TRIAL",
    accusedId,
    verdictVotes: {},
    phaseEndsAt: now + game.options.durations.trial
  };
}

export function startDayVerdict(game: GameState, now: number): GameState {
  ensurePhase(game, "TRIAL", "Verdict phase only follows a trial");
  if (!game.accusedId) {
    throw new GameRuleError("NO_ACCUSED", "No accused player to vote on");
  }
  const voters = livingPlayers(game.players);
  const verdictVotes = Object.fromEntries(voters.map(p => [p.playerId, null as VerdictChoice | null]));
  return {
    ...game,
    phase: "DAY_VERDICT",
    verdictVotes,
    phaseEndsAt: now + game.options.durations.dayVerdict
  };
}

export function recordVerdictVote(game: GameState, voterId: string, choice: VerdictChoice): GameState {
  ensurePhase(game, "DAY_VERDICT", "Verdict votes occur during the verdict phase");
  const voter = assertPlayer(game, voterId, { mustBeAlive: true });
  if (!game.verdictVotes.hasOwnProperty(voter.playerId)) {
    throw new GameRuleError("NOT_A_VOTER", "Player cannot vote in this verdict");
  }
  if (!["HANG", "SPARE"].includes(choice)) {
    throw new GameRuleError("INVALID_CHOICE", "Choice must be HANG or SPARE");
  }
  return { ...game, verdictVotes: { ...game.verdictVotes, [voter.playerId]: choice } };
}

export function areAllVerdictVotesIn(game: GameState): boolean {
  ensurePhase(game, "DAY_VERDICT", "Only check verdict votes during verdict phase");
  const livingIds = new Set(livingPlayers(game.players).map(p => p.playerId));
  return [...livingIds].every(id => game.verdictVotes[id] !== null && game.verdictVotes[id] !== undefined);
}

export function resolveDayVerdict(game: GameState, now: number): GameState {
  ensurePhase(game, "DAY_VERDICT", "Resolve verdict only from verdict phase");
  if (!game.accusedId) {
    throw new GameRuleError("NO_ACCUSED", "No accused player to resolve");
  }

  const players = clonePlayers(game.players);
  const livingIds = new Set(livingPlayers(players).map(p => p.playerId));
  let hangVotes = 0;
  let spareVotes = 0;

  for (const [voterId, choice] of Object.entries(game.verdictVotes)) {
    if (!choice || !livingIds.has(voterId)) continue;
    if (choice === "HANG") hangVotes++;
    else spareVotes++;
  }

  const accused = getPlayer(players, game.accusedId);
  let killed: string | null = null;

  if (hangVotes > spareVotes && accused?.alive) {
    accused.alive = false;
    killed = accused.playerId;
  }

  const baseState: GameState = {
    ...game,
    players,
    lastKilledId: killed ?? game.lastKilledId,
    verdictVotes: {},
    accusedId: null,
    phaseEndsAt: now
  };

  const winner = checkWin(baseState);
  if (winner) {
    return { ...baseState, phase: "GAME_OVER", winner };
  }

  return startNight(baseState, now);
}

export function skipDayToNight(game: GameState, now: number): GameState {
  ensurePhase(game, "DAY_DISCUSSION", "Only discussion can skip straight to night");
  return startNight({ ...game, dayNominations: {}, accusedId: null }, now);
}

export function setPlayerConnection(game: GameState, playerId: string, connected: boolean): GameState {
  const player = getPlayer(game.players, playerId);
  if (!player) return game;
  return {
    ...game,
    players: game.players.map(p => (p.playerId === playerId ? { ...p, connected } : p))
  };
}
