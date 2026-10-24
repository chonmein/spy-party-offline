export type GamePhase =
  | "lobby"
  | "role_reveal"
  | "discussion"
  | "voting"
  | "spy_guess"
  | "finished";

export type Role = "civilian" | "spy";
export type Winner = "civilian" | "spy";

export interface PublicPlayer {
  id: string;
  name: string;
  connected: boolean;
}

export interface PublicResult {
  eliminatedPlayerId?: string;
  eliminatedPlayerName?: string;
  eliminatedRole?: Role;
  voteCounts: Record<string, number>;
  tiedPlayerIds?: string[];
  winner?: Winner;
  spyGuess?: string;
  spyGuessCorrect?: boolean;
}

export interface PublicRoomState {
  roomCode: string;
  phase: GamePhase;
  locked: boolean;
  hostConnected: boolean;
  players: PublicPlayer[];
  voteRound: 1 | 2;
  eligibleTargetIds: string[];
  votesSubmitted: number;
  result?: PublicResult;
}

export interface PrivatePlayerState {
  playerId: string;
  name: string;
  role: Role | null;
  word: string | null;
  canGuess: boolean;
}

export type HostAction =
  | "toggle_lock"
  | "start"
  | "begin_discussion"
  | "begin_voting"
  | "reveal_votes"
  | "reset";

export type ClientMessage =
  | { type: "create_room" }
  | { type: "join_room"; roomCode: string; name: string; token?: string }
  | { type: "reconnect_host"; roomCode: string; token: string }
  | { type: "host_action"; token: string; action: HostAction }
  | { type: "vote"; token: string; targetId: string }
  | { type: "spy_guess"; token: string; guess: string }
  | { type: "heartbeat" };

export type ServerMessage =
  | {
      type: "created";
      roomCode: string;
      token: string;
      state: PublicRoomState;
    }
  | {
      type: "joined" | "reconnected";
      roomCode: string;
      token: string;
      playerId: string;
      state: PublicRoomState;
      privateState: PrivatePlayerState;
    }
  | { type: "state"; state: PublicRoomState }
  | { type: "private"; privateState: PrivatePlayerState }
  | { type: "pong" }
  | { type: "error"; message: string };
