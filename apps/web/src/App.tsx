import { useState, type ReactNode } from "react";
import {
  beginRevote,
  beginVoting,
  createEmptyGame,
  createGame,
  currentRevealPlayer,
  currentVoter,
  finishSecretView,
  MAX_PLAYERS,
  MIN_PLAYERS,
  playerById,
  revealSecret,
  resolveVote,
  submitSpyGuess,
  submitVote,
  topVoteIds,
  WORD_PAIRS,
  type OfflineGameState,
  type Phase,
  type Role,
} from "./offlineGame";

const phaseLabels: Record<Phase, string> = {
  setup: "設定遊戲",
  role_reveal: "查看身分",
  discussion: "現場發言",
  voting: "逐人投票",
  vote_reveal: "揭曉票數",
  tie_break: "平票重投",
  spy_guess: "間諜猜詞",
  finished: "遊戲結束",
};

export default function App() {
  const [game, setGame] = useState<OfflineGameState>(() => createEmptyGame());
  const [playerNames, setPlayerNames] = useState<string[]>(["", "", "", ""]);
  const [selectedVote, setSelectedVote] = useState("");
  const [voterReady, setVoterReady] = useState(false);
  const [spyGuess, setSpyGuess] = useState("");
  const [error, setError] = useState("");

  const updateGame = (next: OfflineGameState): void => {
    setGame(next);
    if (next.phase !== "voting") setVoterReady(false);
    if (next.phase !== "voting") setSelectedVote("");
  };

  const startGame = (): void => {
    try {
      setError("");
      updateGame(createGame(playerNames));
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "無法開始遊戲");
    }
  };

  const startAgain = (): void => {
    setError("");
    updateGame(createGame(playerNames));
  };

  const returnToSetup = (): void => {
    setError("");
    updateGame(createEmptyGame());
  };

  const handleReveal = (): void => updateGame(revealSecret(game));
  const handleFinishSecret = (): void => updateGame(finishSecretView(game));
  const handleBeginVoting = (): void => updateGame(beginVoting(game));

  const handleSubmitVote = (): void => {
    if (!selectedVote) return;
    const next = submitVote(game, selectedVote);
    updateGame(next);
    setSelectedVote("");
    if (next.phase === "voting") setVoterReady(false);
  };

  const handleResolveVote = (): void => updateGame(resolveVote(game));
  const handleBeginRevote = (): void => updateGame(beginRevote(game));

  const handleSubmitGuess = (): void => {
    const next = submitSpyGuess(game, spyGuess);
    if (next === game) return;
    setSpyGuess("");
    updateGame(next);
  };

  if (game.phase === "setup") {
    return (
      <Shell error={error} phase={game.phase}>
        <SetupScreen
          names={playerNames}
          error={error}
          onNamesChange={setPlayerNames}
          onStart={startGame}
          onError={setError}
        />
      </Shell>
    );
  }

  return (
    <Shell error={error} phase={game.phase}>
      <GameScreen
        game={game}
        selectedVote={selectedVote}
        voterReady={voterReady}
        spyGuess={spyGuess}
        onReveal={handleReveal}
        onFinishSecret={handleFinishSecret}
        onBeginVoting={handleBeginVoting}
        onVoterReady={() => setVoterReady(true)}
        onVoteSelect={setSelectedVote}
        onSubmitVote={handleSubmitVote}
        onResolveVote={handleResolveVote}
        onBeginRevote={handleBeginRevote}
        onSpyGuess={setSpyGuess}
        onSubmitGuess={handleSubmitGuess}
        onStartAgain={startAgain}
        onReturnToSetup={returnToSetup}
      />
    </Shell>
  );
}

function Shell({ children, error, phase }: { children: ReactNode; error: string; phase: Phase }) {
  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar">
        <div className="brand-mark"><span>SPY</span><small>OFFLINE PARTY</small></div>
        <div className="connection offline"><span className="connection-dot" />純離線模式</div>
      </header>
      {error && <div className="toast error-toast" role="alert">{error}</div>}
      <section className="content">{children}</section>
      <footer className="footer">{phase === "setup" ? "一台裝置・輪流傳遞・不需伺服器" : "請把裝置交給畫面指定的玩家"}</footer>
    </main>
  );
}

function SetupScreen({
  names,
  error,
  onNamesChange,
  onStart,
  onError,
}: {
  names: string[];
  error: string;
  onNamesChange: (names: string[]) => void;
  onStart: () => void;
  onError: (message: string) => void;
}) {
  const updateName = (index: number, value: string): void => {
    const next = [...names];
    next[index] = value;
    onNamesChange(next);
    if (error) onError("");
  };

  const addPlayer = (): void => {
    if (names.length >= MAX_PLAYERS) return;
    onNamesChange([...names, ""]);
  };

  const removePlayer = (index: number): void => {
    if (names.length <= MIN_PLAYERS) return;
    onNamesChange(names.filter((_, playerIndex) => playerIndex !== index));
  };

  return (
    <div className="setup-layout">
      <section className="hero-copy">
        <p className="eyebrow">PASS-AND-PLAY / NO SERVER</p>
        <h1>誰是<br /><em>間諜？</em></h1>
        <p className="hero-description">一台裝置輪流傳遞，每個人私下查看自己的詞語，再靠描述與直覺把間諜揪出來。</p>
        <div className="feature-strip"><span>不需網路</span><span>4–12 人</span><span>{WORD_PAIRS.length.toLocaleString()} 組題目</span></div>
      </section>

      <section className="panel setup-panel">
        <div className="setup-heading">
          <div><p className="panel-kicker">MISSION SETUP</p><h2>設定玩家</h2></div>
          <span className="player-count">{names.length}/{MAX_PLAYERS}</span>
        </div>
        <p className="muted">請輸入現場玩家名稱。開始後，裝置會依序交給每位玩家查看身分。</p>
        <div className="name-list">
          {names.map((name, index) => (
            <div className="name-row" key={`player-input-${index}`}>
              <span className="number-badge">{index + 1}</span>
              <input
                aria-label={`第 ${index + 1} 位玩家名稱`}
                value={name}
                onChange={(event) => updateName(index, event.target.value)}
                placeholder={`玩家 ${index + 1}`}
                maxLength={16}
                onKeyDown={(event) => { if (event.key === "Enter") onStart(); }}
              />
              {names.length > MIN_PLAYERS && <button className="icon-button" aria-label={`移除第 ${index + 1} 位玩家`} onClick={() => removePlayer(index)}>×</button>}
            </div>
          ))}
        </div>
        <div className="setup-actions">
          <button className="secondary-button" onClick={addPlayer} disabled={names.length >= MAX_PLAYERS}>＋ 新增玩家</button>
          <button className="primary-button" onClick={onStart}>開始遊戲 <span>→</span></button>
        </div>
        <p className="privacy-note"><span>●</span> 身分只會在這台裝置上短暫顯示，重新整理後不會保存。</p>
      </section>
    </div>
  );
}

function GameScreen({
  game,
  selectedVote,
  voterReady,
  spyGuess,
  onReveal,
  onFinishSecret,
  onBeginVoting,
  onVoterReady,
  onVoteSelect,
  onSubmitVote,
  onResolveVote,
  onBeginRevote,
  onSpyGuess,
  onSubmitGuess,
  onStartAgain,
  onReturnToSetup,
}: {
  game: OfflineGameState;
  selectedVote: string;
  voterReady: boolean;
  spyGuess: string;
  onReveal: () => void;
  onFinishSecret: () => void;
  onBeginVoting: () => void;
  onVoterReady: () => void;
  onVoteSelect: (playerId: string) => void;
  onSubmitVote: () => void;
  onResolveVote: () => void;
  onBeginRevote: () => void;
  onSpyGuess: (value: string) => void;
  onSubmitGuess: () => void;
  onStartAgain: () => void;
  onReturnToSetup: () => void;
}) {
  return (
    <div className="game-layout">
      <div className="game-heading">
        <div><p className="eyebrow">OFFLINE MISSION</p><h2>{game.phase === "finished" ? "任務完成" : "現場遊戲中"}</h2></div>
        <PhaseBadge phase={game.phase} />
      </div>
      <ProgressBar phase={game.phase} />
      <div className="game-panel panel">
        {game.phase === "role_reveal" && <RevealPhase game={game} onReveal={onReveal} onFinish={onFinishSecret} />}
        {game.phase === "discussion" && <DiscussionPhase onBeginVoting={onBeginVoting} />}
        {game.phase === "voting" && <VotingPhase game={game} ready={voterReady} selectedVote={selectedVote} onReady={onVoterReady} onSelect={onVoteSelect} onSubmit={onSubmitVote} />}
        {game.phase === "vote_reveal" && <VoteRevealPhase game={game} onContinue={onResolveVote} />}
        {game.phase === "tie_break" && <TieBreakPhase game={game} onBeginRevote={onBeginRevote} />}
        {game.phase === "spy_guess" && <SpyGuessPhase game={game} guess={spyGuess} onChange={onSpyGuess} onSubmit={onSubmitGuess} />}
        {game.phase === "finished" && <FinishedPhase game={game} onStartAgain={onStartAgain} onReturnToSetup={onReturnToSetup} />}
      </div>
      <PlayerRibbon game={game} />
    </div>
  );
}

function ProgressBar({ phase }: { phase: Phase }) {
  const phases: Phase[] = ["role_reveal", "discussion", "voting", "finished"];
  const index = phase === "tie_break" || phase === "vote_reveal" ? 2 : phase === "spy_guess" ? 3 : phases.indexOf(phase);
  return <div className="progress-bar" aria-label="遊戲進度">{phases.map((item, itemIndex) => <span className={itemIndex <= index ? "active" : ""} key={item}>{itemIndex + 1}</span>)}</div>;
}

function RevealPhase({ game, onReveal, onFinish }: { game: OfflineGameState; onReveal: () => void; onFinish: () => void }) {
  const player = currentRevealPlayer(game);
  if (!player) return null;
  const role = game.roles[player.id];
  return (
    <div className="phase-content reveal-content">
      <p className="panel-kicker">SECRET PASS {game.revealIndex + 1} / {game.players.length}</p>
      {!game.secretVisible ? (
        <>
          <div className="handoff-icon">⇄</div>
          <h3>請把裝置交給<br /><strong>{player.name}</strong></h3>
          <p className="muted">確認只有 {player.name} 能看到螢幕後，再按下按鈕。</p>
          <button className="primary-button big-button" onClick={onReveal}>我是 {player.name}，查看身分</button>
        </>
      ) : (
        <div className={`secret-card ${role === "spy" ? "spy-secret" : "civilian-secret"}`}>
          <p className="secret-role-label">{role === "spy" ? "你是間諜" : "你是平民"}</p>
          <div className="secret-role-icon">{role === "spy" ? "◉" : "✦"}</div>
          <p className="word-caption">你的詞語</p>
          <strong className="secret-word">{game.words[player.id]}</strong>
          <p className="secret-warning">記住你的詞語，不要讓其他人看到。</p>
          <button className="primary-button big-button" onClick={onFinish}>我記住了，隱藏並交給下一位</button>
        </div>
      )}
    </div>
  );
}

function DiscussionPhase({ onBeginVoting }: { onBeginVoting: () => void }) {
  return (
    <div className="phase-content centered-content">
      <div className="phase-symbol">✦</div>
      <p className="panel-kicker">DISCUSSION TIME</p>
      <h3>每個人說一句線索</h3>
      <p className="muted">依序描述你的詞語，但不要直接說出答案。觀察誰的描述太模糊，或太像事先準備好的。</p>
      <div className="tip-grid"><span>不要說出詞語本身</span><span>留意彼此的反應</span><span>主持人決定何時投票</span></div>
      <button className="primary-button big-button" onClick={onBeginVoting}>討論完成，開始逐人投票 →</button>
    </div>
  );
}

function VotingPhase({ game, ready, selectedVote, onReady, onSelect, onSubmit }: { game: OfflineGameState; ready: boolean; selectedVote: string; onReady: () => void; onSelect: (playerId: string) => void; onSubmit: () => void }) {
  const voter = currentVoter(game);
  if (!voter) return null;
  if (!ready) {
    return <div className="phase-content centered-content"><div className="handoff-icon">☝</div><p className="panel-kicker">ANONYMOUS VOTE / {game.votingRound === 2 ? "REVOTE" : "ROUND 1"}</p><h3>請把裝置交給<br /><strong>{voter.name}</strong></h3><p className="muted">其他人請不要看螢幕。{voter.name} 準備好後，按下開始投票。</p><button className="primary-button big-button" onClick={onReady}>我是 {voter.name}，開始投票</button></div>;
  }
  const candidates = game.players.filter((player) => game.eligibleTargetIds.includes(player.id) && player.id !== voter.id);
  return (
    <div className="phase-content vote-content">
      <p className="panel-kicker">{game.votingRound === 2 ? "平票重投" : "匿名投票"} · {voter.name} 的回合</p>
      <h3>你覺得誰是間諜？</h3>
      <p className="muted small">選一位其他玩家，提交後不會顯示你的選擇。</p>
      <div className="candidate-list">{candidates.map((player) => <button className={`candidate ${selectedVote === player.id ? "selected" : ""}`} key={player.id} onClick={() => onSelect(player.id)}><span className="avatar">{player.name.slice(0, 1)}</span><span>{player.name}</span><span className="candidate-check">{selectedVote === player.id ? "✓" : ""}</span></button>)}</div>
      <button className="primary-button full-button" disabled={!selectedVote} onClick={onSubmit}>提交匿名投票 →</button>
    </div>
  );
}

function VoteRevealPhase({ game, onContinue }: { game: OfflineGameState; onContinue: () => void }) {
  const leaders = topVoteIds(game.voteTally);
  return <div className="phase-content vote-content"><p className="panel-kicker">VOTE REVEAL · ROUND {game.votingRound}</p><h3>{leaders.length > 1 ? "出現平票" : "票數揭曉"}</h3><p className="muted">所有人的選擇已經收齊，現在公開票數。</p><div className="tally-list">{game.players.map((player) => <div className={`tally-row ${leaders.includes(player.id) ? "leader" : ""}`} key={player.id}><span>{player.name}</span><strong>{game.voteTally[player.id] ?? 0} 票</strong></div>)}</div><p className="tally-note">{leaders.length > 1 ? `最高票：${leaders.map((id) => playerById(game, id)?.name).join("、")}` : `最高票：${playerById(game, leaders[0])?.name ?? "—"}`}</p><button className="primary-button big-button" onClick={onContinue}>{leaders.length > 1 && game.votingRound === 1 ? "進入平票重投 →" : "繼續揭曉結果 →"}</button></div>;
}

function TieBreakPhase({ game, onBeginRevote }: { game: OfflineGameState; onBeginRevote: () => void }) {
  const tiedPlayers = game.eligibleTargetIds.map((id) => playerById(game, id)).filter((player): player is NonNullable<typeof player> => Boolean(player));
  return <div className="phase-content centered-content"><div className="phase-symbol warning-symbol">!</div><p className="panel-kicker">TIE BREAK</p><h3>平票，還不能揭曉</h3><p className="muted">請只在以下平手玩家中重新投票。</p><div className="tied-list">{tiedPlayers.map((player) => <span key={player.id}>{player.name}</span>)}</div><button className="primary-button big-button" onClick={onBeginRevote}>開始平票重投 →</button></div>;
}

function SpyGuessPhase({ game, guess, onChange, onSubmit }: { game: OfflineGameState; guess: string; onChange: (value: string) => void; onSubmit: () => void }) {
  const eliminated = playerById(game, game.result?.eliminatedPlayerId);
  return <div className="phase-content centered-content"><div className="phase-symbol spy-symbol">◉</div><p className="panel-kicker">ONE LAST CHANCE</p><h3>{eliminated?.name ?? "間諜"} 被投出了</h3><p className="muted">請把裝置交給間諜。只要猜中平民的詞語，就能翻盤獲勝。</p><label className="guess-label">間諜猜測的平民詞語<input autoFocus value={guess} onChange={(event) => onChange(event.target.value)} placeholder="輸入你的猜測" onKeyDown={(event) => { if (event.key === "Enter") onSubmit(); }} /></label><button className="primary-button big-button" disabled={!guess.trim()} onClick={onSubmit}>提交猜詞 →</button></div>;
}

function FinishedPhase({ game, onStartAgain, onReturnToSetup }: { game: OfflineGameState; onStartAgain: () => void; onReturnToSetup: () => void }) {
  const spy = game.players.find((player) => game.roles[player.id] === "spy");
  const civilianWord = game.wordPair?.civilian ?? "—";
  const spyWord = game.wordPair?.spy ?? "—";
  const winnerIsSpy = game.result?.winner === "spy";
  return <div className="phase-content result-content"><div className={`result-banner ${winnerIsSpy ? "spy-win" : "civilian-win"}`}><div className="phase-symbol">{winnerIsSpy ? "◉" : "✦"}</div><p className="panel-kicker">MISSION COMPLETE</p><h3>{winnerIsSpy ? "間諜陣營勝利" : "平民陣營勝利"}</h3><p>{resultReason(game)}</p></div><div className="final-reveal"><div><span>間諜</span><strong>{spy?.name ?? "—"}</strong></div><div><span>平民詞語</span><strong>{civilianWord}</strong></div><div><span>間諜詞語</span><strong>{spyWord}</strong></div></div>{game.result?.spyGuess && <p className="guess-result">間諜猜測「{game.result.spyGuess}」{game.result.spyGuessCorrect ? "，猜中了！" : "，猜錯了。"}</p>}<div className="result-actions"><button className="primary-button" onClick={onStartAgain}>同一批玩家再玩一局</button><button className="secondary-button" onClick={onReturnToSetup}>重新設定玩家</button></div></div>;
}

function resultReason(game: OfflineGameState): string {
  switch (game.result?.reason) {
    case "civilian_eliminated": return "最高票投中了平民。";
    case "second_tie": return "第二次投票仍然平手，間諜趁亂逃走了。";
    case "spy_guess": return game.result.spyGuessCorrect ? "間諜在最後關頭猜中了平民詞語。" : "間諜沒有猜中平民詞語。";
    case "spy_eliminated": return "大家成功找出了間諜。";
    default: return "這一局已經結束。";
  }
}

function PlayerRibbon({ game }: { game: OfflineGameState }) {
  return <div className="player-ribbon"><span>本局玩家</span>{game.players.map((player) => <span className="mini-player" key={player.id}>{player.name}</span>)}</div>;
}

function PhaseBadge({ phase }: { phase: Phase }) {
  return <span className="phase-badge"><span />{phaseLabels[phase]}</span>;
}

export function roleLabel(role: Role): string {
  return role === "spy" ? "間諜" : "平民";
}
