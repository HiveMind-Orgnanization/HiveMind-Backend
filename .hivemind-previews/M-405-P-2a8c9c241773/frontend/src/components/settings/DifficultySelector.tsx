import type { Difficulty } from '../../routes/Game';

interface DifficultySelectorProps {
  value: Difficulty;
  onChange: (value: Difficulty) => void;
}

const options: { value: Difficulty; label: string; description: string }[] = [
  { value: 'easy', label: 'Easy', description: 'Slower speed, relaxed pacing.' },
  { value: 'normal', label: 'Normal', description: 'Balanced speed for most players.' },
  { value: 'hard', label: 'Hard', description: 'Fast and unforgiving.' },
];

export function DifficultySelector({ value, onChange }: DifficultySelectorProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`text-left rounded-xl border px-3 py-3 text-sm focus-ring transition-colors ${
            value === opt.value
              ? 'border-primary bg-emerald-50 dark:bg-emerald-900/20 text-slate-900 dark:text-emerald-50'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <div className="font-semibold mb-1">{opt.label}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{opt.description}</div>
        </button>
      ))}
    </div>
  );
}
