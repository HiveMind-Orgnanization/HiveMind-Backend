import { FormEvent, useState } from "react";
import { X } from "lucide-react";

interface GameOverModalProps {
  open: boolean;
  score: number;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
  onRetry: () => void;
}

export function GameOverModal({ open, score, onClose, onSave, onRetry }: GameOverModalProps) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a name to save your score.");
      return;
    }
    if (trimmed.length > 20) {
      setError("Name must be 20 characters or fewer.");
      return;
    }
    try {
      setSaving(true);
      await onSave(trimmed);
      setSaving(false);
      onClose();
    } catch (err) {
      console.error(err);
      setSaving(false);
      setError("Failed to save score. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 text-slate-50 shadow-2xl border border-slate-700">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-lg font-semibold">Game over</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-label="Close game over dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 pb-4 space-y-4">
          <div className="rounded-xl bg-slate-800/80 border border-slate-700 px-4 py-3 flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Score</div>
            <div className="text-2xl font-semibold text-emerald-400 tabular-nums">{score}</div>
          </div>
          <p className="text-sm text-slate-300">
            Nice run. Save your score to the global leaderboard or jump straight back into another game.
          </p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="player-name" className="text-xs font-medium text-slate-300">
                Player name
              </label>
              <input
                id="player-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                placeholder="Arcade legend"
                maxLength={20}
              />
              {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
            </div>
            <div className="flex flex-wrap gap-2 justify-between pt-1">
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                Play again
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex flex-1 items-center justify-center rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                {saving ? "Saving..." : "Save to leaderboard"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
