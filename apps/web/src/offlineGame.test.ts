import assert from "node:assert/strict";
import test from "node:test";
import {
  beginRevote,
  beginVoting,
  createGame,
  finishSecretView,
  revealSecret,
  resolveVote,
  submitSpyGuess,
  submitVote,
  WORD_PAIRS,
} from "./offlineGame";
import { toZhuyin } from "./zhuyin";

const names = ["甲", "乙", "丙", "丁"];

test("內建題庫包含 10,000 組不重複配對", () => {
  assert.equal(WORD_PAIRS.length, 10_000);
  assert.equal(new Set(WORD_PAIRS.map((pair) => `${pair.civilian}\u0000${pair.spy}`)).size, 10_000);
});

test("題目可以產生繁體中文注音", () => {
  assert.equal(toZhuyin("咖啡"), "ㄎㄚ ㄈㄟ");
  assert.equal(toZhuyin("早餐桌上：咖啡"), "ㄗㄠˇ ㄘㄢ ㄓㄨㄛ ㄕㄤˋ ： ㄎㄚ ㄈㄟ");
});

function revealEveryone() {
  let state = createGame(names, () => 0);
  while (state.phase === "role_reveal") state = finishSecretView(revealSecret(state));
  return state;
}

test("一般投票可判定平民被淘汰，間諜獲勝", () => {
  let state = beginVoting(revealEveryone());
  for (const target of ["player-2", "player-3", "player-2", "player-2"]) state = submitVote(state, target);
  state = resolveVote(state);
  assert.equal(state.phase, "finished");
  assert.equal(state.result?.winner, "spy");
  assert.equal(state.result?.reason, "civilian_eliminated");
});

test("間諜被投出後猜中平民詞語可以翻盤", () => {
  let state = beginVoting(revealEveryone());
  for (const target of ["player-2", "player-1", "player-1", "player-1"]) state = submitVote(state, target);
  state = resolveVote(state);
  assert.equal(state.phase, "spy_guess");
  state = submitSpyGuess(state, "咖啡");
  assert.equal(state.phase, "finished");
  assert.equal(state.result?.winner, "spy");
  assert.equal(state.result?.spyGuessCorrect, true);
});

test("第一次平票會進入限定候選人的重投，第二次仍平票則間諜獲勝", () => {
  let state = beginVoting(revealEveryone());
  for (const target of ["player-2", "player-3", "player-2", "player-3"]) state = submitVote(state, target);
  state = resolveVote(state);
  assert.equal(state.phase, "tie_break");
  assert.deepEqual(state.eligibleTargetIds, ["player-2", "player-3"]);
  state = beginRevote(state);
  for (const target of ["player-2", "player-3", "player-2", "player-3"]) state = submitVote(state, target);
  state = resolveVote(state);
  assert.equal(state.phase, "finished");
  assert.equal(state.result?.reason, "second_tie");
  assert.equal(state.result?.winner, "spy");
});
