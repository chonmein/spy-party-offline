export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 12;

export type Role = "civilian" | "spy";
export type Phase = "setup" | "role_reveal" | "discussion" | "voting" | "vote_reveal" | "tie_break" | "spy_guess" | "finished";
export type Winner = "civilian" | "spy";

export type Player = {
  id: string;
  name: string;
};

export type WordPair = {
  civilian: string;
  spy: string;
};

export type GameResult = {
  winner: Winner;
  reason: "civilian_eliminated" | "spy_eliminated" | "spy_guess" | "second_tie";
  eliminatedPlayerId?: string;
  eliminatedRole?: Role;
  spyGuess?: string;
  spyGuessCorrect?: boolean;
};

export type OfflineGameState = {
  phase: Phase;
  players: Player[];
  roles: Record<string, Role>;
  words: Record<string, string>;
  wordPair: WordPair | null;
  revealIndex: number;
  secretVisible: boolean;
  votingRound: 1 | 2;
  currentVoterIndex: number;
  eligibleTargetIds: string[];
  votes: Record<string, string>;
  voteTally: Record<string, number>;
  result: GameResult | null;
};

export const WORD_PAIRS: WordPair[] = [
  { civilian: "咖啡", spy: "奶茶" },
  { civilian: "火車", spy: "捷運" },
  { civilian: "海邊", spy: "湖邊" },
  { civilian: "雨傘", spy: "雨衣" },
  { civilian: "蛋糕", spy: "甜甜圈" },
  { civilian: "書店", spy: "圖書館" },
  { civilian: "狗狗", spy: "貓咪" },
  { civilian: "太陽", spy: "月亮" },
  { civilian: "夏天", spy: "春天" },
  { civilian: "山", spy: "森林" },
  { civilian: "冰箱", spy: "微波爐" },
  { civilian: "電影", spy: "影集" },
  { civilian: "足球", spy: "籃球" },
  { civilian: "醫院", spy: "診所" },
  { civilian: "早餐", spy: "宵夜" },
  { civilian: "公車", spy: "計程車" },
  { civilian: "帽子", spy: "圍巾" },
  { civilian: "相機", spy: "手機" },
  { civilian: "蛋", spy: "豆腐" },
  { civilian: "海豚", spy: "鯨魚" },
  { civilian: "生日", spy: "畢業" },
  { civilian: "電影院", spy: "遊樂園" },
  { civilian: "披薩", spy: "漢堡" },
  { civilian: "游泳", spy: "跑步" },
];

export function createEmptyGame(): OfflineGameState {
  return {
    phase: "setup",
    players: [],
    roles: {},
    words: {},
    wordPair: null,
    revealIndex: 0,
    secretVisible: false,
    votingRound: 1,
    currentVoterIndex: 0,
    eligibleTargetIds: [],
    votes: {},
    voteTally: {},
    result: null,
  };
}

export function normalizeNames(names: string[]): string[] {
  return names.map((name) => name.trim()).filter(Boolean);
}

export function validateNames(names: string[]): string | null {
  const normalized = normalizeNames(names);
  if (normalized.length < MIN_PLAYERS) return `至少需要 ${MIN_PLAYERS} 位玩家`;
  if (normalized.length > MAX_PLAYERS) return `最多只能有 ${MAX_PLAYERS} 位玩家`;
  if (new Set(normalized.map((name) => name.toLocaleLowerCase())).size !== normalized.length) {
    return "玩家名稱不能重複";
  }
  return null;
}

export function createGame(names: string[], random = Math.random): OfflineGameState {
  const error = validateNames(names);
  if (error) throw new Error(error);

  const normalized = normalizeNames(names);
  const players = normalized.map((name, index) => ({ id: `player-${index + 1}`, name }));
  const spyIndex = Math.floor(random() * players.length);
  const wordPair = WORD_PAIRS[Math.floor(random() * WORD_PAIRS.length)] ?? WORD_PAIRS[0];
  const roles: Record<string, Role> = {};
  const words: Record<string, string> = {};

  players.forEach((player, index) => {
    const role: Role = index === spyIndex ? "spy" : "civilian";
    roles[player.id] = role;
    words[player.id] = role === "spy" ? wordPair.spy : wordPair.civilian;
  });

  return {
    ...createEmptyGame(),
    phase: "role_reveal",
    players,
    roles,
    words,
    wordPair,
    eligibleTargetIds: players.map((player) => player.id),
  };
}

export function currentRevealPlayer(state: OfflineGameState): Player | undefined {
  return state.players[state.revealIndex];
}

export function currentVoter(state: OfflineGameState): Player | undefined {
  return state.players[state.currentVoterIndex];
}

export function revealSecret(state: OfflineGameState): OfflineGameState {
  if (state.phase !== "role_reveal") return state;
  return { ...state, secretVisible: true };
}

export function finishSecretView(state: OfflineGameState): OfflineGameState {
  if (state.phase !== "role_reveal" || !state.secretVisible) return state;
  const isLastPlayer = state.revealIndex >= state.players.length - 1;
  return isLastPlayer
    ? { ...state, phase: "discussion", revealIndex: 0, secretVisible: false }
    : { ...state, revealIndex: state.revealIndex + 1, secretVisible: false };
}

export function beginVoting(state: OfflineGameState): OfflineGameState {
  if (state.phase !== "discussion") return state;
  return {
    ...state,
    phase: "voting",
    votingRound: 1,
    currentVoterIndex: 0,
    eligibleTargetIds: state.players.map((player) => player.id),
    votes: {},
    voteTally: {},
  };
}

function tallyVotes(votes: Record<string, string>): Record<string, number> {
  return Object.values(votes).reduce<Record<string, number>>((tally, targetId) => {
    tally[targetId] = (tally[targetId] ?? 0) + 1;
    return tally;
  }, {});
}

export function topVoteIds(tally: Record<string, number>): string[] {
  const highest = Math.max(0, ...Object.values(tally));
  return Object.entries(tally)
    .filter(([, count]) => count === highest && highest > 0)
    .map(([playerId]) => playerId);
}

export function submitVote(state: OfflineGameState, targetId: string): OfflineGameState {
  if (state.phase !== "voting") return state;
  const voter = currentVoter(state);
  if (!voter || state.votes[voter.id]) return state;
  if (targetId === voter.id || !state.eligibleTargetIds.includes(targetId)) return state;

  const votes = { ...state.votes, [voter.id]: targetId };
  const allVotesSubmitted = Object.keys(votes).length === state.players.length;
  return allVotesSubmitted
    ? { ...state, phase: "vote_reveal", votes, voteTally: tallyVotes(votes) }
    : { ...state, votes, currentVoterIndex: state.currentVoterIndex + 1 };
}

export function beginRevote(state: OfflineGameState): OfflineGameState {
  if (state.phase !== "tie_break") return state;
  return {
    ...state,
    phase: "voting",
    votingRound: 2,
    currentVoterIndex: 0,
    votes: {},
    voteTally: {},
  };
}

export function resolveVote(state: OfflineGameState): OfflineGameState {
  if (state.phase !== "vote_reveal") return state;
  const leaders = topVoteIds(state.voteTally);
  if (leaders.length > 1) {
    if (state.votingRound === 1) {
      return { ...state, phase: "tie_break", eligibleTargetIds: leaders };
    }
    return {
      ...state,
      phase: "finished",
      result: { winner: "spy", reason: "second_tie" },
    };
  }

  const eliminatedPlayerId = leaders[0];
  const eliminatedRole = eliminatedPlayerId ? state.roles[eliminatedPlayerId] : undefined;
  if (eliminatedRole === "spy") {
    return {
      ...state,
      phase: "spy_guess",
      result: { winner: "civilian", reason: "spy_eliminated", eliminatedPlayerId, eliminatedRole },
    };
  }
  return {
    ...state,
    phase: "finished",
    result: { winner: "spy", reason: "civilian_eliminated", eliminatedPlayerId, eliminatedRole },
  };
}

export function submitSpyGuess(state: OfflineGameState, guess: string): OfflineGameState {
  if (state.phase !== "spy_guess" || !state.wordPair || !state.result?.eliminatedPlayerId) return state;
  const normalizedGuess = guess.trim();
  if (!normalizedGuess) return state;
  const correct = normalizedGuess.localeCompare(state.wordPair.civilian, undefined, { sensitivity: "base" }) === 0;
  return {
    ...state,
    phase: "finished",
    result: {
      ...state.result,
      winner: correct ? "spy" : "civilian",
      reason: "spy_guess",
      spyGuess: normalizedGuess,
      spyGuessCorrect: correct,
    },
  };
}

export function playerById(state: OfflineGameState, playerId?: string): Player | undefined {
  return state.players.find((player) => player.id === playerId);
}
