import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw, Volume2, VolumeX, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { GameCanvas, Direction } from "./GameCanvas";
import { MobileControls } from "./MobileControls";
import { ScoreBoard } from "./ScoreBoard";
import { GameOverModal } from "./GameOverModal";
import { useToast } from "./Toast";

export function GamePage() {
  const [running, setRunning] = useState(true);
  const [difficulty, setDifficulty] = useState<"easy" | "normal" | "hard">("normal");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastScore, setLastScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => {
    const stored = window.localStorage.getItem("snake-best-score");
    return stored ? Number(stored) || 0 : 0;
  });
  const [gameOverOpen, setGameOverOpen] = useState(false);
  const [savingScore, setSavingScore] = useState(false);

  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    const storedDifficulty = window.localStorage.getItem("snake-difficulty");
    if (storedDifficulty === "easy" || storedDifficulty === "normal" || storedDifficulty === "hard") {
      setDifficulty(storedDifficulty);
    }
    const storedSound = window.localStorage.getItem("snake-sound-enabled");
    if (storedSound === "true" || storedSound === "false") {
      setSoundEnabled(storedSound === "true");
    }
  }, []);

  const handleGameOver = (score: number) => {
    setLastScore(score);
    const storedBest = window.localStorage.getItem("snake-best-score");
    const best = storedBest ? Number(storedBest) || 0 : 0;
    setBestScore(best);
    setGameOverOpen(true);
  };

  const handleRetry = () => {
    setGameOverOpen(false);
    setRunning(false);
    window.setTimeout(() => setRunning(true), 50);
  };

  const handleSaveScore = async (name: string) => {
    setSavingScore(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/leaderboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, score: lastScore }),
      });
      if (!res.ok) throw new Error("Failed to save score");
      showToast("Score saved to leaderboard");
    } finally {
      setSavingScore(false);
    }
  };

  const handleDirectionChange = (dir: Direction) => {
    const keyboardEvent = new KeyboardEvent("keydown", {
      code:
        dir === "up"
          ? "ArrowUp"
          : dir === "down"
          ? "ArrowDown"
          : dir === "left"
          ? "ArrowLeft"
          : "ArrowRight",
    });
    window.dispatchEvent(keyboardEvent);
  };

  const togglePause = () => setRunning((r) => !r);

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      window.localStorage.setItem("snake-sound-enabled", String(next));
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Arcade mode</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Use arrow keys or the on-screen pad. Avoid the walls and your own tail.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Home className="h-3.5 w-3.5" />
          Home
        </button>
      </div>

      <ScoreBoard score={lastScore} bestScore={bestScore} difficulty={difficulty} />

      <GameCanvas
        running={running}
        onGameOver={handleGameOver}
        difficulty={difficulty}
        soundEnabled={soundEnabled}
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/90 border border-slate-700 px-3 py-1.5 text-xs text-slate-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {running ? "Live" : "Paused"}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={togglePause}
            className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-100 border border-slate-700 hover:bg-slate-800"
          >
            {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {running ? "Pause" : "Resume"}
          </button>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-100 border border-slate-700 hover:bg-slate-800"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restart
          </button>
          <button
            type="button"
            onClick={toggleSound}
            className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-100 border border-slate-700 hover:bg-slate-800"
          >
            {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            {soundEnabled ? "Sound on" : "Sound off"}
          </button>
        </div>
      </div>

      <MobileControls onDirectionChange={handleDirectionChange} />

      <GameOverModal
        open={gameOverOpen}
        score={lastScore}
        onClose={() => setGameOverOpen(false)}
        onSave={handleSaveScore}
        onRetry={handleRetry}
      />

      {savingScore && (
        <div className="fixed inset-x-0 bottom-4 flex justify-center pointer-events-none">
          <div className="pointer-events-auto rounded-full bg-slate-900/90 border border-slate-700 px-4 py-1.5 text-xs text-slate-100 shadow-lg">
            Syncing score with leaderboard...
          </div>
        </div>
      )}
    </div>
  );
}
