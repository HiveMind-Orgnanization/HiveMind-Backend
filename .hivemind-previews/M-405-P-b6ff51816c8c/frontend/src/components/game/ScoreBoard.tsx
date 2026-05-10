import type { Difficulty } from '../../routes/Game';

interface ScoreBoardProps {
  score: number;
  bestScore: number;
  difficulty: Difficulty;
  status: 'idle' | 'running' | 'paused' | 'over';
}

export function ScoreBoard({ score, bestScore, difficulty, status }: ScoreBoardProps) {
  const difficultyLabel =
    difficulty === 'easy' ? 'Easy' : difficulty === 'hard' ? 'Hard' : 'Normal';

  const statusLabel =
    status === 'idle' ? 'Press any arrow key to start' : status === 'running' ? 'Running' : status === 'paused' ? 'Paused' : 'Game Over';

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 mb-1">Score</div>
          <div className="text-3xl font-semibold tabular-nums">{score}</div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 mb-1">Best</div>
          <div className="text-xl font-semibold tabular-nums">{bestScore}</div>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>
          Difficulty: <span className="font-medium text-slate-700 dark:text-slate-200">{difficultyLabel}</span>
        </span>
        <span>{statusLabel}</span>
      </div>
    </div>
  );
}
