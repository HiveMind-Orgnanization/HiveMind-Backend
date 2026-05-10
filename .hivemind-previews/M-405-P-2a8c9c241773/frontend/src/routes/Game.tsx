import { useState } from 'react';
import { GameCanvas } from '../components/game/GameCanvas';
import { ScoreBoard } from '../components/game/ScoreBoard';
import { PauseOverlay } from '../components/game/PauseOverlay';
import { MobileControls } from '../components/game/MobileControls';
import { GameOverModal } from '../components/game/GameOverModal';
import { useLocalStorage } from '../hooks/useLocalStorage';

export type Difficulty = 'easy' | 'normal' | 'hard';

export function Game() {
  const [difficulty] = useLocalStorage<Difficulty>('snake-neo:difficulty', 'normal');
  const [soundEnabled] = useLocalStorage<boolean>('snake-neo:sound', true);
  const [bestScore, setBestScore] = useLocalStorage<number>('snake-neo:best-score', 0);

  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<'idle' | 'running' | 'paused' | 'over'>('idle');

  const handleScoreChange = (value: number) => {
    setScore(value);
    if (value > bestScore) setBestScore(value);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] items-start">
      <div className="relative">
        <div className="rounded-3xl bg-slate-900 border border-slate-800 shadow-xl p-3 sm:p-4">
          <GameCanvas
            difficulty={difficulty}
            soundEnabled={soundEnabled}
            onScoreChange={handleScoreChange}
            onStatusChange={setStatus}
          />
          <PauseOverlay status={status} />
          <MobileControls />
        </div>
      </div>

      <div className="space-y-4">
        <ScoreBoard score={score} bestScore={bestScore} difficulty={difficulty} status={status} />
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-sm text-slate-600 dark:text-slate-300 space-y-2">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">Controls</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Arrow keys or WASD to move</li>
            <li>Space or Enter to pause / resume</li>
            <li>On mobile, use the on-screen D-pad</li>
          </ul>
        </div>
      </div>

      <GameOverModal
        open={status === 'over'}
        score={score}
        difficulty={difficulty}
        onRestart={() => setStatus('idle')}
      />
    </div>
  );
}
