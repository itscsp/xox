import { useState, useCallback, useRef } from "react";

type Player = "X" | "O";
type Cell = Player | null;
type Board = Cell[];

const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const MAX_MARKS = 3;

function checkWinner(board: Board): { winner: Player; combo: number[] } | null {
  for (const combo of WINNING_COMBOS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a] as Player, combo };
    }
  }
  return null;
}

// ── Sound engine (Web Audio API) ──────────────────────────────────────────────
function getAudioCtx(): AudioContext {
  const w = window as typeof window & { _tttCtx?: AudioContext };
  if (!w._tttCtx) w._tttCtx = new AudioContext();
  return w._tttCtx;
}

function playTone(freq: number, type: OscillatorType, duration: number, gain = 0.25) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gainNode.gain.setValueAtTime(gain, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (_) {}
}

const sounds = {
  placeX: () => playTone(440, "square", 0.12, 0.2),
  placeO: () => playTone(330, "sine", 0.14, 0.22),
  vanish: () => {
    playTone(200, "sawtooth", 0.18, 0.12);
  },
  win: () => {
    playTone(523, "sine", 0.15, 0.3);
    setTimeout(() => playTone(659, "sine", 0.15, 0.15), 120);
    setTimeout(() => playTone(784, "sine", 0.2, 0.3), 240);
  },
  reset: () => playTone(300, "triangle", 0.1, 0.1),
};

// ─────────────────────────────────────────────────────────────────────────────

interface CellState {
  animClass: "none" | "pop-in" | "fade-out";
}

export default function App() {
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState<Player>("X");
  const [xMoves, setXMoves] = useState<number[]>([]);
  const [oMoves, setOMoves] = useState<number[]>([]);
  const [winner, setWinner] = useState<{ winner: Player; combo: number[] } | null>(null);
  const [scores, setScores] = useState({ X: 0, O: 0, draws: 0 });
  const [cellAnims, setCellAnims] = useState<CellState[]>(Array(9).fill({ animClass: "none" }));
  const [nextToFade, setNextToFade] = useState<{ X: number | null; O: number | null }>({ X: null, O: null });

  const triggerAnim = useCallback((index: number, cls: "pop-in" | "fade-out") => {
    setCellAnims(prev => {
      const next = [...prev];
      next[index] = { animClass: cls };
      return next;
    });
    setTimeout(() => {
      setCellAnims(prev => {
        const next = [...prev];
        next[index] = { animClass: "none" };
        return next;
      });
    }, 350);
  }, []);

  const handleCellPress = useCallback((index: number) => {
    if (board[index] || winner) return;

    const moves = currentPlayer === "X" ? xMoves : oMoves;
    const setMoves = currentPlayer === "X" ? setXMoves : setOMoves;

    let newBoard = [...board];
    let removedIndex: number | null = null;

    if (moves.length >= MAX_MARKS) {
      removedIndex = moves[0];
      triggerAnim(removedIndex, "fade-out");
      sounds.vanish();
      newBoard[removedIndex] = null;
      setMoves(prev => [...prev.slice(1), index]);
    } else {
      setMoves(prev => [...prev, index]);
    }

    newBoard[index] = currentPlayer;
    triggerAnim(index, "pop-in");
    currentPlayer === "X" ? sounds.placeX() : sounds.placeO();

    const result = checkWinner(newBoard);
    if (result) {
      setBoard(newBoard);
      setWinner(result);
      setScores(prev => ({ ...prev, [result.winner]: prev[result.winner] + 1 }));
      setTimeout(() => sounds.win(), 50);
      return;
    }

    setBoard(newBoard);
    const nextPlayer: Player = currentPlayer === "X" ? "O" : "X";
    setCurrentPlayer(nextPlayer);

    const newXMoves = currentPlayer === "X"
      ? (moves.length >= MAX_MARKS ? [...moves.slice(1), index] : [...moves, index])
      : xMoves;
    const newOMoves = currentPlayer === "O"
      ? (moves.length >= MAX_MARKS ? [...moves.slice(1), index] : [...moves, index])
      : oMoves;

    const newNextToFade: { X: number | null; O: number | null } = { X: null, O: null };
    if (newXMoves.length >= MAX_MARKS) newNextToFade.X = newXMoves[0];
    if (newOMoves.length >= MAX_MARKS) newNextToFade.O = newOMoves[0];
    setNextToFade(newNextToFade);
  }, [board, currentPlayer, xMoves, oMoves, winner, triggerAnim]);

  const resetGame = useCallback(() => {
    sounds.reset();
    setBoard(Array(9).fill(null));
    setCurrentPlayer("X");
    setXMoves([]);
    setOMoves([]);
    setWinner(null);
    setNextToFade({ X: null, O: null });
    setCellAnims(Array(9).fill({ animClass: "none" }));
  }, []);

  const resetAll = useCallback(() => {
    sounds.reset();
    setBoard(Array(9).fill(null));
    setCurrentPlayer("X");
    setXMoves([]);
    setOMoves([]);
    setWinner(null);
    setNextToFade({ X: null, O: null });
    setCellAnims(Array(9).fill({ animClass: "none" }));
    setScores({ X: 0, O: 0, draws: 0 });
  }, []);

  const isWinningCell = (i: number) => winner?.combo.includes(i) ?? false;
  const isFadingCell = (i: number) => {
    if (board[i] === "X" && nextToFade.X === i) return true;
    if (board[i] === "O" && nextToFade.O === i) return true;
    return false;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#0A0A0A" }}>
      <div className="w-full max-w-sm flex flex-col gap-5">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-[0.4em] text-white">TIC TAC TOE</h1>
          <p className="text-xs font-semibold tracking-[0.3em] mt-1" style={{ color: "#444" }}>3-MARK CHALLENGE</p>
        </div>

        {/* Scores */}
        <div className="flex gap-3 items-center">
          <ScoreCard label="Player X" score={scores.X} player="X" isActive={!winner && currentPlayer === "X"} />
          <div className="flex flex-col items-center min-w-[48px]">
            <span className="text-[10px] font-semibold tracking-[0.2em]" style={{ color: "#444" }}>DRAWS</span>
            <span className="text-2xl font-bold" style={{ color: "#666" }}>{scores.draws}</span>
          </div>
          <ScoreCard label="Player O" score={scores.O} player="O" isActive={!winner && currentPlayer === "O"} />
        </div>

        {/* Status */}
        <div className="h-8 flex items-center justify-center">
          {winner ? (
            <span className="text-xl font-bold tracking-wider"
              style={{ color: winner.winner === "X" ? "#4FC3F7" : "#FFA726" }}>
              Player {winner.winner} wins! 🎉
            </span>
          ) : (
            <div className="flex items-center gap-1 text-base">
              <span style={{ color: "#888" }}>Turn:</span>
              <span className="text-xl font-bold"
                style={{ color: currentPlayer === "X" ? "#4FC3F7" : "#FFA726" }}>
                {currentPlayer}
              </span>
              {nextToFade[currentPlayer] !== null && (
                <span className="text-[11px] ml-1" style={{ color: "#444" }}>· oldest mark will vanish</span>
              )}
            </div>
          )}
        </div>

        {/* Board */}
        <div
          className="rounded-2xl p-1.5 grid gap-1.5"
          style={{ backgroundColor: "#2A2A2A", gridTemplateColumns: "repeat(3, 1fr)" }}
        >
          {board.map((cell, i) => {
            const winning = isWinningCell(i);
            const fading = isFadingCell(i);
            const anim = cellAnims[i];

            return (
              <button
                key={i}
                onClick={() => handleCellPress(i)}
                className="aspect-square rounded-xl flex items-center justify-center cursor-pointer"
                style={{
                  backgroundColor: winning ? "#1A1A00" : "#1A1A1A",
                  border: winning ? "1.5px solid #FFA726" : "1.5px solid transparent",
                  transition: "background-color 0.2s",
                }}
              >
                <div
                  className={
                    anim.animClass === "pop-in" ? "mark-pop-in" :
                    anim.animClass === "fade-out" ? "mark-fade-out" : ""
                  }
                  style={{ width: "56%", height: "56%", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  {cell === "X" && <XMark fading={fading} />}
                  {cell === "O" && <OMark fading={fading} />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Rule hint */}
        <p className="text-center text-xs" style={{ color: "#444" }}>
          Each player can have max 3 marks — oldest disappears!
        </p>

        {/* Credit */}
        <p className="text-center text-[11px]" style={{ color: "#333" }}>
          Built by chethanspoojary.com
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={resetGame}
            className="flex-1 py-4 rounded-2xl font-bold text-base tracking-wide transition-opacity hover:opacity-90 active:opacity-75"
            style={{ backgroundColor: "#FFA726", color: "#000" }}
          >
            New Game
          </button>
          <button
            onClick={resetAll}
            className="flex-1 py-4 rounded-2xl font-semibold text-[15px] transition-opacity hover:opacity-90 active:opacity-75"
            style={{ backgroundColor: "#1A1A1A", color: "#888", border: "1px solid #2A2A2A" }}
          >
            Reset Scores
          </button>
        </div>

      </div>
    </div>
  );
}

function XMark({ fading }: { fading: boolean }) {
  const color = fading ? "#1A4A6A" : "#4FC3F7";
  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div style={{
        position: "absolute",
        top: "50%",
        left: "0",
        width: "100%",
        height: "16%",
        marginTop: "-8%",
        backgroundColor: color,
        borderRadius: "4px",
        transform: "rotate(45deg)",
        transition: "background-color 0.3s",
      }} />
      <div style={{
        position: "absolute",
        top: "50%",
        left: "0",
        width: "100%",
        height: "16%",
        marginTop: "-8%",
        backgroundColor: color,
        borderRadius: "4px",
        transform: "rotate(-45deg)",
        transition: "background-color 0.3s",
      }} />
    </div>
  );
}

function OMark({ fading }: { fading: boolean }) {
  const color = fading ? "#5A3A10" : "#FFA726";
  return (
    <div style={{
      width: "100%",
      height: "100%",
      borderRadius: "50%",
      border: `8px solid ${color}`,
      boxSizing: "border-box",
      transition: "border-color 0.3s",
    }} />
  );
}

function ScoreCard({ label, score, player, isActive }: {
  label: string; score: number; player: Player; isActive: boolean;
}) {
  const color = player === "X" ? "#4FC3F7" : "#FFA726";
  return (
    <div
      className="flex-1 flex flex-col items-center py-3 rounded-xl"
      style={{
        backgroundColor: "#111",
        border: isActive ? `1.5px solid ${color}` : "1px solid #2A2A2A",
        transition: "border-color 0.2s",
      }}
    >
      <span className="text-[11px] font-semibold tracking-wider mb-1" style={{ color }}>{label}</span>
      <span className="text-4xl font-bold" style={{ color }}>{score}</span>
    </div>
  );
}
