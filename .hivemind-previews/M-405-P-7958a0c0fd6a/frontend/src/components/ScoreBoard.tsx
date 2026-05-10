interface ScoreBoardProps {
  score: number;
  bestScore: number;
  difficulty: "easy" | "normal" | "hard";
}

export function ScoreBoard({ score, bestScore, difficulty }: ScoreBoardProps) {
  const difficultyLabel =
    difficulty === "easy" ? "Easy" : difficulty === "hard" ? "Hard" : "Normal";

  const difficultyColor =
    difficulty === "easy"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/40"
      : difficulty === "hard"
      ? "bg-rose-500/10 text-rose-400 border-rose-500/40"
      : "bg-sky-500/10 text-sky-400 border-sky-500/40";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-3 text-sm">
        <div className="rounded-2xl bg-slate-900/90 border border-slate-700 px-3 py-2 flex items-baseline gap-2">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Score</span>
          <span className="text-lg font-semibold text-emerald-400 tabular-nums">{score}</span>
        </div>
        <div className="rounded-2xl bg-slate-900/60 border border-slate-700 px-3 py-2 flex items-baseline gap-2">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Best</span>
          <span className="text-lg font-semibold text-sky-400 tabular-nums">{bestScore}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 font-medium ${difficultyColor}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {difficultyLabel} mode
        </span>
      </div>
    </div>
  );
}
