import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { submitScore } from '../../lib/api';
import { useToast } from '../ui/Toast';
import type { Difficulty } from '../../routes/Game';

interface GameOverModalProps {
  open: boolean;
  score: number;
  difficulty: Difficulty;
  onRestart: () => void;
}

export function GameOverModal({ open, score, difficulty, onRestart }: GameOverModalProps) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Enter a name to save your score');
      return;
    }
    setSaving(true);
    try {
      await submitScore({ name: name.trim(), score, difficulty });
      showToast('Score saved to leaderboard');
      onRestart();
    } catch (err: any) {
      showToast(err.message || 'Failed to save score');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open}>
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold mb-1">Game Over</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Nice run. Want to claim your spot on the board?</p>
        </div>
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 mb-1">Score</div>
            <div className="text-3xl font-semibold tabular-nums">{score}</div>
          </div>
          <div className="text-right text-xs text-slate-500 dark:text-slate-400">
            Difficulty: <span className="font-medium text-slate-700 dark:text-slate-200">{difficulty}</span>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300" htmlFor="player-name">
            Name for leaderboard
          </label>
          <input
            id="player-name"
            type="text"
            maxLength={20}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus-ring"
            placeholder="Player 1"
          />
        </div>
        <div className="flex flex-wrap gap-3 justify-between pt-1">
          <div className="flex gap-2">
            <Button className="px-4 py-2" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save score'}
            </Button>
            <Button variant="secondary" className="px-4 py-2" onClick={onRestart}>
              Play again
            </Button>
          </div>
          <a
            href="/leaderboard"
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-300 self-center"
          >
            View leaderboard
          </a>
        </div>
      </div>
    </Modal>
  );
}
