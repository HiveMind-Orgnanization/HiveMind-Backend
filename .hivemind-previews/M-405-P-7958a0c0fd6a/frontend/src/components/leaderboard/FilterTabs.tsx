interface FilterTabsProps {
  value: 'all' | 'week';
  onChange: (value: 'all' | 'week') => void;
}

export function FilterTabs({ value, onChange }: FilterTabsProps) {
  return (
    <div className="inline-flex rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100/60 dark:bg-slate-900/60 p-1 text-xs">
      <button
        type="button"
        onClick={() => onChange('all')}
        className={`px-3 py-1.5 rounded-full transition-colors ${
          value === 'all'
            ? 'bg-slate-900 text-slate-50 shadow-sm'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-800'
        }`}
      >
        All-time
      </button>
      <button
        type="button"
        onClick={() => onChange('week')}
        className={`px-3 py-1.5 rounded-full transition-colors ${
          value === 'week'
            ? 'bg-slate-900 text-slate-50 shadow-sm'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-800'
        }`}
      >
        This Week
      </button>
    </div>
  );
}
