import { randomBytes, randomInt } from "node:crypto";
import type {
  GamePhase,
  HostAction,
  PrivatePlayerState,
  PublicRoomState,
  PublicResult,
  Role,
  Winner,
} from "@spy/protocol";

export interface WordPair {
  civilian: string;
  spy: string;
}

export interface PlayerRecord {
  id: string;
  token: string;
  name: string;
  connected: boolean;
  role: Role | null;
  civilianWord: string | null;
  spyWord: string | null;
  voteTargetId: string | null;
}

export interface RoomResult extends PublicResult {
  winner?: Winner;
}

export interface Room {
  roomCode: string;
  hostToken: string;
  hostConnected: boolean;
  phase: GamePhase;
  locked: boolean;
  players: Map<string, PlayerRecord>;
  voteRound: 1 | 2;
  eligibleTargetIds: string[];
  wordPair: WordPair | null;
  spyToken: string | null;
  result?: RoomResult;
  lastActivityAt: number;
}

export class GameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameError";
  }
}

export const WORD_PAIRS: WordPair[] = [
  { civilian: "珍珠奶茶", spy: "水果茶" },
  { civilian: "籃球", spy: "排球" },
  { civilian: "貓咪", spy: "狐狸" },
  { civilian: "火鍋", spy: "燒烤" },
  { civilian: "夜市", spy: "商圈" },
  { civilian: "雨傘", spy: "雨衣" },
  { civilian: "電影院", spy: "劇院" },
  { civilian: "登山", spy: "露營" },
  { civilian: "咖啡", spy: "奶茶" },
  { civilian: "機器人", spy: "人工智慧" },
  { civilian: "海邊", spy: "游泳池" },
  { civilian: "生日蛋糕", spy: "甜甜圈" },
];

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function token(): string {
  return randomBytes(18).toString("base64url");
}

export function normalizeRoomCode(value: string): string {
  return value.trim().toUpperCase();
}

export function normalizeGuess(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, "");
}

export function createRoom(roomCode: string): Room {
  return {
    roomCode: normalizeRoomCode(roomCode),
    hostToken: token(),
    hostConnected: true,
    phase: "lobby",
    locked: false,
    players: new Map(),
    voteRound: 1,
    eligibleTargetIds: [],
    wordPair: null,
    spyToken: null,
    lastActivityAt: Date.now(),
  };
}

export function makeRoomCode(): string {
  return Array.from({ length: 5 }, () => ROOM_ALPHABET[randomInt(ROOM_ALPHABET.length)]).join("");
}

export function addPlayer(room: Room, name: string, reconnectToken?: string): PlayerRecord {
  if (room.locked || room.phase !== "lobby") {
    throw new GameError("房間已鎖定，無法加入新玩家");
  }

  const cleanName = name.trim().replace(/\s+/g, " ");
  if (cleanName.length < 1 || cleanName.length > 16) {
    throw new GameError("暱稱需要 1–16 個字元");
  }
  if (room.players.size >= 12) {
    throw new GameError("房間最多只能有 12 位玩家");
  }
  const duplicate = [...room.players.values()].some(
    (player) => player.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase(),
  );
  if (duplicate) {
    throw new GameError("這個暱稱已經有人使用");
  }

  const player: PlayerRecord = {
    id: `p${room.players.size + 1}`,
    token: reconnectToken ?? token(),
    name: cleanName,
    connected: true,
    role: null,
    civilianWord: null,
    spyWord: null,
    voteTargetId: null,
  };
  room.players.set(player.token, player);
  touch(room);
  return player;
}

export function reconnectPlayer(room: Room, playerToken: string): PlayerRecord {
  const player = room.players.get(playerToken);
  if (!player) {
    throw new GameError("找不到這位玩家的重新連線資訊");
  }
  player.connected = true;
  touch(room);
  return player;
}

export function getPlayer(room: Room, playerToken: string): PlayerRecord {
  const player = room.players.get(playerToken);
  if (!player) {
    throw new GameError("玩家身分無效");
  }
  return player;
}

export function publicState(room: Room): PublicRoomState {
  const state: PublicRoomState = {
    roomCode: room.roomCode,
    phase: room.phase,
    locked: room.locked,
    hostConnected: room.hostConnected,
    players: [...room.players.values()].map(({ id, name, connected }) => ({ id, name, connected })),
    voteRound: room.voteRound,
    eligibleTargetIds: [...room.eligibleTargetIds],
    votesSubmitted: [...room.players.values()].filter((player) => player.voteTargetId !== null).length,
  };
  if (room.result) {
    state.result = structuredClone(room.result);
  }
  return state;
}

export function privateState(room: Room, playerToken: string): PrivatePlayerState {
  const player = getPlayer(room, playerToken);
  return {
    playerId: player.id,
    name: player.name,
    role: player.role,
    word: player.role === "spy" ? player.spyWord : player.civilianWord,
    canGuess: room.phase === "spy_guess" && player.role === "spy",
  };
}

export function hostAction(room: Room, hostToken: string, action: HostAction): void {
  if (room.hostToken !== hostToken) {
    throw new GameError("主持人身分無效");
  }
  touch(room);

  switch (action) {
    case "toggle_lock":
      if (room.phase !== "lobby") throw new GameError("只有等待加入時才能鎖定房間");
      room.locked = !room.locked;
      return;
    case "start":
      startGame(room);
      return;
    case "begin_discussion":
      if (room.phase !== "role_reveal") throw new GameError("目前不能進入發言階段");
      room.phase = "discussion";
      return;
    case "begin_voting":
      if (room.phase !== "discussion") throw new GameError("目前不能進入投票階段");
      room.phase = "voting";
      room.voteRound = 1;
      room.eligibleTargetIds = [...room.players.values()].map((player) => player.id);
      clearVotes(room);
      room.result = undefined;
      return;
    case "reveal_votes":
      if (room.phase !== "voting") throw new GameError("目前不是投票階段");
      resolveVotes(room);
      return;
    case "reset":
      resetGame(room);
      return;
  }
}

function startGame(room: Room): void {
  if (room.phase !== "lobby") throw new GameError("這局遊戲已經開始");
  if (room.players.size < 4) throw new GameError("至少需要 4 位玩家才能開始");

  const players = [...room.players.values()];
  const spy = players[randomInt(players.length)];
  const pair = WORD_PAIRS[randomInt(WORD_PAIRS.length)];
  room.spyToken = spy.token;
  room.wordPair = pair;
  room.locked = true;
  room.phase = "role_reveal";
  room.voteRound = 1;
  room.eligibleTargetIds = [];
  room.result = undefined;

  for (const player of players) {
    player.role = player.token === spy.token ? "spy" : "civilian";
    player.civilianWord = pair.civilian;
    player.spyWord = pair.spy;
    player.voteTargetId = null;
  }
}

export function recordVote(room: Room, playerToken: string, targetId: string): void {
  if (room.phase !== "voting") throw new GameError("目前不是投票階段");
  const player = getPlayer(room, playerToken);
  if (!room.eligibleTargetIds.includes(targetId)) {
    throw new GameError("這位玩家目前不是可投票對象");
  }
  if (player.id === targetId) {
    throw new GameError("不能投給自己");
  }
  if (![...room.players.values()].some((candidate) => candidate.id === targetId)) {
    throw new GameError("找不到投票對象");
  }
  player.voteTargetId = targetId;
  touch(room);
}

function resolveVotes(room: Room): void {
  const voteCounts: Record<string, number> = {};
  for (const player of room.players.values()) {
    if (player.voteTargetId) {
      voteCounts[player.voteTargetId] = (voteCounts[player.voteTargetId] ?? 0) + 1;
    }
  }
  if (Object.keys(voteCounts).length === 0) {
    throw new GameError("目前還沒有任何投票");
  }

  const maxVotes = Math.max(...Object.values(voteCounts));
  const tiedIds = room.eligibleTargetIds.filter((id) => (voteCounts[id] ?? 0) === maxVotes);
  room.result = { voteCounts };

  if (tiedIds.length > 1) {
    room.result.tiedPlayerIds = tiedIds;
    if (room.voteRound === 1) {
      room.voteRound = 2;
      room.eligibleTargetIds = tiedIds;
      clearVotes(room);
      room.phase = "voting";
      return;
    }
    room.result.winner = "spy";
    room.phase = "finished";
    return;
  }

  const eliminated = [...room.players.values()].find((player) => player.id === tiedIds[0]);
  if (!eliminated) throw new GameError("無法找到最高票玩家");
  room.result.eliminatedPlayerId = eliminated.id;
  room.result.eliminatedPlayerName = eliminated.name;
  room.result.eliminatedRole = eliminated.role ?? undefined;

  if (eliminated.role === "spy") {
    room.phase = "spy_guess";
  } else {
    room.result.winner = "spy";
    room.phase = "finished";
  }
}

export function submitSpyGuess(room: Room, playerToken: string, guess: string): void {
  if (room.phase !== "spy_guess") throw new GameError("目前不能猜詞");
  const player = getPlayer(room, playerToken);
  if (player.role !== "spy" || player.token !== room.spyToken) {
    throw new GameError("只有被投出的間諜可以猜詞");
  }
  const cleanGuess = guess.trim();
  if (!cleanGuess) throw new GameError("請輸入你的猜測");
  if (!room.wordPair) throw new GameError("找不到本局詞語");

  const correct = normalizeGuess(cleanGuess) === normalizeGuess(room.wordPair.civilian);
  room.result ??= { voteCounts: {} };
  room.result.spyGuess = cleanGuess;
  room.result.spyGuessCorrect = correct;
  room.result.winner = correct ? "spy" : "civilian";
  room.phase = "finished";
  touch(room);
}

function clearVotes(room: Room): void {
  for (const player of room.players.values()) player.voteTargetId = null;
}

function resetGame(room: Room): void {
  room.phase = "lobby";
  room.locked = false;
  room.voteRound = 1;
  room.eligibleTargetIds = [];
  room.wordPair = null;
  room.spyToken = null;
  room.result = undefined;
  for (const player of room.players.values()) {
    player.role = null;
    player.civilianWord = null;
    player.spyWord = null;
    player.voteTargetId = null;
  }
  touch(room);
}

function touch(room: Room): void {
  room.lastActivityAt = Date.now();
}
