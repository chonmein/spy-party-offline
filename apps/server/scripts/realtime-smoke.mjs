import assert from "node:assert/strict";
import WebSocket from "ws";

const serverUrl = process.argv[2] ?? "ws://localhost:8787";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function openClient() {
  const socket = new WebSocket(serverUrl, process.env.SMOKE_ORIGIN ? { headers: { Origin: process.env.SMOKE_ORIGIN } } : undefined);
  const messages = [];
  socket.on("message", (data) => messages.push(JSON.parse(data.toString())));
  await new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  return { socket, messages };
}

async function waitFor(client, predicate, label) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    const found = client.messages.find(predicate);
    if (found) return found;
    await wait(20);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function send(client, message) {
  client.socket.send(JSON.stringify(message));
}

async function runRoom(playerCount) {
  const sockets = [];
  const host = await openClient();
  sockets.push(host);
  send(host, { type: "create_room" });
  const created = await waitFor(host, (message) => message.type === "created", "room creation");

  const players = [];
  for (let index = 0; index < playerCount; index += 1) {
    const client = await openClient();
    sockets.push(client);
    const name = `測試${index + 1}`;
    send(client, { type: "join_room", roomCode: created.roomCode, name });
    const joined = await waitFor(client, (message) => message.type === "joined", `${name} joining`);
    players.push({ ...joined, client, name });
  }

  const reconnecting = players[0];
  reconnecting.client.socket.close();
  await wait(50);
  const replacement = await openClient();
  sockets.push(replacement);
  send(replacement, { type: "join_room", roomCode: created.roomCode, name: "", token: reconnecting.token });
  await waitFor(replacement, (message) => message.type === "reconnected", "player reconnection");
  reconnecting.client = replacement;

  send(host, { type: "host_action", token: created.token, action: "start" });
  await waitFor(host, (message) => message.type === "state" && message.state.phase === "role_reveal", "role reveal");
  for (const player of players) {
    await waitFor(player.client, (message) => message.type === "private" && message.privateState.role, `${player.name} private role`);
  }

  const spy = players.find((player) => player.client.messages.some((message) => message.type === "private" && message.privateState.role === "spy"));
  assert.ok(spy, `expected one spy for ${playerCount} players`);
  const civilian = players.find((player) => player !== spy);
  assert.ok(civilian);

  send(host, { type: "host_action", token: created.token, action: "begin_discussion" });
  await waitFor(host, (message) => message.type === "state" && message.state.phase === "discussion", "discussion");
  send(host, { type: "host_action", token: created.token, action: "begin_voting" });
  await waitFor(host, (message) => message.type === "state" && message.state.phase === "voting", "voting");

  for (const player of players) {
    send(player.client, {
      type: "vote",
      token: player.token,
      targetId: player === spy ? civilian.playerId : spy.playerId,
    });
  }
  await wait(100);
  send(host, { type: "host_action", token: created.token, action: "reveal_votes" });
  await waitFor(host, (message) => message.type === "state" && message.state.phase === "spy_guess", "spy guess");
  send(spy.client, { type: "spy_guess", token: spy.token, guess: "完全不是這個詞" });
  const finished = await waitFor(host, (message) => message.type === "state" && message.state.phase === "finished", "finished result");
  assert.equal(finished.state.result.winner, "civilian");

  for (const client of sockets) client.socket.close();
  return { playerCount, roomCode: created.roomCode, spy: spy.name, reconnect: true, winner: finished.state.result.winner };
}

const results = [];
for (const playerCount of [4, 8, 12]) results.push(await runRoom(playerCount));
console.log(JSON.stringify({ ok: true, serverUrl, rooms: results }));
