import assert from "node:assert/strict";
import test from "node:test";
import type { Role } from "@spy/protocol";
import {
  GameError,
  WORD_PAIRS,
  addPlayer,
  createRoom,
  hostAction,
  privateState,
  publicState,
  reconnectPlayer,
  recordVote,
  submitSpyGuess,
} from "./game.js";

function roomWithPlayers(count = 4) {
  const room = createRoom("TEST1");
  for (let index = 0; index < count; index += 1) addPlayer(room, `玩家${index + 1}`);
  return room;
}

function playerById(room: ReturnType<typeof roomWithPlayers>, id: string) {
  const player = [...room.players.values()].find((candidate) => candidate.id === id);
  assert.ok(player);
  return player;
}

test("assigns one spy and keeps private roles out of public state", () => {
  const room = roomWithPlayers();
  hostAction(room, room.hostToken, "start");

  const publicRoom = publicState(room);
  assert.equal(publicRoom.phase, "role_reveal");
  assert.equal(publicRoom.players.length, 4);
  assert.equal("role" in publicRoom.players[0], false);
  assert.equal("word" in publicRoom, false);

  const privateRoles: Role[] = [...room.players.keys()].map((token) => privateState(room, token).role).filter(
    (role): role is Role => role !== null,
  );
  assert.equal(privateRoles.filter((role) => role === "spy").length, 1);
  assert.equal(privateRoles.filter((role) => role === "civilian").length, 3);
  assert.equal(new Set([...room.players.values()].map((player) => player.civilianWord)).size, 1);
  assert.equal(room.wordPair?.civilian, WORD_PAIRS.find((pair) => pair.civilian === room.wordPair?.civilian)?.civilian);
});

test("a caught spy can guess the civilian word and win", () => {
  const room = roomWithPlayers();
  hostAction(room, room.hostToken, "start");
  hostAction(room, room.hostToken, "begin_discussion");
  hostAction(room, room.hostToken, "begin_voting");

  const spy = [...room.players.values()].find((player) => player.role === "spy");
  assert.ok(spy);
  const civilians = [...room.players.values()].filter((player) => player.role !== "spy");
  for (const civilian of civilians) recordVote(room, civilian.token, spy.id);
  recordVote(room, spy.token, civilians[0].id);

  hostAction(room, room.hostToken, "reveal_votes");
  assert.equal(room.phase, "spy_guess");
  assert.equal(privateState(room, spy.token).canGuess, true);
  assert.ok(room.wordPair);

  submitSpyGuess(room, spy.token, room.wordPair.civilian);
  assert.equal(room.phase, "finished");
  assert.equal(room.result?.winner, "spy");
  assert.equal(room.result?.spyGuessCorrect, true);
});

test("a second tied vote gives the spy the win", () => {
  const room = roomWithPlayers();
  hostAction(room, room.hostToken, "start");
  hostAction(room, room.hostToken, "begin_discussion");
  hostAction(room, room.hostToken, "begin_voting");

  const players = [...room.players.values()];
  recordVote(room, players[2].token, players[0].id);
  recordVote(room, players[3].token, players[1].id);
  hostAction(room, room.hostToken, "reveal_votes");
  assert.equal(room.phase, "voting");
  assert.equal(room.voteRound, 2);
  assert.deepEqual(room.eligibleTargetIds.sort(), [players[0].id, players[1].id].sort());

  recordVote(room, players[2].token, players[0].id);
  recordVote(room, players[3].token, players[1].id);
  hostAction(room, room.hostToken, "reveal_votes");
  assert.equal(room.phase, "finished");
  assert.equal(room.result?.winner, "spy");
});

test("rejects self-votes and votes outside the active candidate set", () => {
  const room = roomWithPlayers();
  hostAction(room, room.hostToken, "start");
  hostAction(room, room.hostToken, "begin_discussion");
  hostAction(room, room.hostToken, "begin_voting");
  const player = [...room.players.values()][0];

  assert.throws(() => recordVote(room, player.token, player.id), GameError);
  assert.throws(() => recordVote(room, player.token, "not-a-player"), GameError);
});

test("reconnection preserves the player's private identity", () => {
  const room = roomWithPlayers();
  const player = [...room.players.values()][0];
  hostAction(room, room.hostToken, "start");
  const before = privateState(room, player.token);
  player.connected = false;
  reconnectPlayer(room, player.token);
  const after = privateState(room, player.token);
  assert.deepEqual(after, before);
  assert.equal(player.connected, true);
});
