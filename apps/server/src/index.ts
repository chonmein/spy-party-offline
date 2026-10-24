import { createServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import type { ClientMessage, ServerMessage } from "@spy/protocol";
import {
  GameError,
  addPlayer,
  createRoom,
  getPlayer,
  hostAction,
  makeRoomCode,
  normalizeRoomCode,
  privateState,
  publicState,
  reconnectPlayer,
  recordVote,
  submitSpyGuess,
  type Room,
} from "./game.js";

type Session =
  | { roomCode: string; token: string; kind: "host" }
  | { roomCode: string; token: string; kind: "player" };

const PORT = Number(process.env.PORT ?? 8787);
const ROOM_TTL_MS = 30 * 60 * 1000;
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const rooms = new Map<string, Room>();
const sessions = new Map<WebSocket, Session>();
const socketByToken = new Map<string, WebSocket>();

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function sendError(socket: WebSocket, message: string): void {
  send(socket, { type: "error", message });
}

function getRoom(roomCode: string): Room {
  const room = rooms.get(normalizeRoomCode(roomCode));
  if (!room) throw new GameError("找不到這個房間");
  room.lastActivityAt = Date.now();
  return room;
}

function closePreviousConnection(token: string, replacement: WebSocket): void {
  const previous = socketByToken.get(token);
  if (previous && previous !== replacement && previous.readyState === WebSocket.OPEN) {
    previous.close(4001, "reconnected");
  }
  socketByToken.set(token, replacement);
}

function broadcast(room: Room): void {
  const state = publicState(room);
  for (const [socket, session] of sessions) {
    if (session.roomCode !== room.roomCode) continue;
    send(socket, { type: "state", state });
    if (session.kind === "player") {
      try {
        send(socket, { type: "private", privateState: privateState(room, session.token) });
      } catch {
        // The session can close between the state and private update.
      }
    }
  }
}

function attachHost(room: Room, socket: WebSocket, hostToken: string): void {
  if (room.hostToken !== hostToken) throw new GameError("主持人身分無效");
  closePreviousConnection(hostToken, socket);
  room.hostConnected = true;
  sessions.set(socket, { roomCode: room.roomCode, token: hostToken, kind: "host" });
  send(socket, { type: "state", state: publicState(room) });
  broadcast(room);
}

function attachPlayer(room: Room, socket: WebSocket, playerToken: string, reconnect: boolean): void {
  const player = reconnect ? reconnectPlayer(room, playerToken) : getPlayer(room, playerToken);
  closePreviousConnection(player.token, socket);
  sessions.set(socket, { roomCode: room.roomCode, token: player.token, kind: "player" });
  send(socket, {
    type: reconnect ? "reconnected" : "joined",
    roomCode: room.roomCode,
    token: player.token,
    playerId: player.id,
    state: publicState(room),
    privateState: privateState(room, player.token),
  });
  broadcast(room);
}

function createNewRoom(socket: WebSocket): void {
  let roomCode = makeRoomCode();
  while (rooms.has(roomCode)) roomCode = makeRoomCode();
  const room = createRoom(roomCode);
  rooms.set(roomCode, room);
  sessions.set(socket, { roomCode, token: room.hostToken, kind: "host" });
  socketByToken.set(room.hostToken, socket);
  send(socket, { type: "created", roomCode, token: room.hostToken, state: publicState(room) });
}

function parseMessage(raw: string): ClientMessage {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || !("type" in parsed)) {
    throw new GameError("訊息格式無效");
  }
  return parsed as ClientMessage;
}

function handleMessage(socket: WebSocket, message: ClientMessage): void {
  switch (message.type) {
    case "create_room":
      createNewRoom(socket);
      return;
    case "join_room": {
      const room = getRoom(message.roomCode);
      if (message.token) {
        if (!room.players.has(message.token)) throw new GameError("玩家重新連線資訊無效");
        attachPlayer(room, socket, message.token, true);
      } else {
        const player = addPlayer(room, message.name);
        attachPlayer(room, socket, player.token, false);
      }
      return;
    }
    case "reconnect_host": {
      const room = getRoom(message.roomCode);
      attachHost(room, socket, message.token);
      return;
    }
    case "host_action": {
      const session = sessions.get(socket);
      if (!session || session.kind !== "host" || session.token !== message.token) {
        throw new GameError("只有主持人可以執行這個操作");
      }
      const room = getRoom(session.roomCode);
      hostAction(room, message.token, message.action);
      broadcast(room);
      return;
    }
    case "vote": {
      const session = sessions.get(socket);
      if (!session || session.kind !== "player" || session.token !== message.token) {
        throw new GameError("玩家身分無效");
      }
      const room = getRoom(session.roomCode);
      recordVote(room, message.token, message.targetId);
      broadcast(room);
      return;
    }
    case "spy_guess": {
      const session = sessions.get(socket);
      if (!session || session.kind !== "player" || session.token !== message.token) {
        throw new GameError("玩家身分無效");
      }
      const room = getRoom(session.roomCode);
      submitSpyGuess(room, message.token, message.guess);
      broadcast(room);
      return;
    }
    case "heartbeat": {
      const session = sessions.get(socket);
      if (session) {
        const room = rooms.get(session.roomCode);
        if (room) room.lastActivityAt = Date.now();
      }
      send(socket, { type: "pong" });
      return;
    }
  }
}

const httpServer = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("Spy Party server");
});

const websocketServer = new WebSocketServer({ server: httpServer });

websocketServer.on("connection", (socket, request) => {
  const origin = request.headers.origin;
  if (allowedOrigins.size > 0 && (!origin || !allowedOrigins.has(origin))) {
    socket.close(1008, "origin not allowed");
    return;
  }

  socket.on("message", (raw) => {
    try {
      handleMessage(socket, parseMessage(raw.toString()));
    } catch (error) {
      sendError(socket, error instanceof Error ? error.message : "伺服器發生未知錯誤");
    }
  });

  socket.on("close", () => {
    const session = sessions.get(socket);
    if (!session) return;
    sessions.delete(socket);
    if (socketByToken.get(session.token) !== socket) return;
    socketByToken.delete(session.token);
    const room = rooms.get(session.roomCode);
    if (!room) return;
    if (session.kind === "host") {
      room.hostConnected = false;
    } else {
      const player = room.players.get(session.token);
      if (player) player.connected = false;
    }
    room.lastActivityAt = Date.now();
    broadcast(room);
  });
});

setInterval(() => {
  const cutoff = Date.now() - ROOM_TTL_MS;
  for (const [roomCode, room] of rooms) {
    if (room.lastActivityAt < cutoff) rooms.delete(roomCode);
  }
}, 60_000).unref();

httpServer.listen(PORT, () => {
  console.log(`Spy Party server listening on http://localhost:${PORT}`);
});
