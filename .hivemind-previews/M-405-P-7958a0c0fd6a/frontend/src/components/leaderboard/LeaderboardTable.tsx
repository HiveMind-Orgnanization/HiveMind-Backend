import { LeaderboardScore } from '../../lib/api';

interface LeaderboardTableProps {
  scores: LeaderboardScore[];
}

export function LeaderboardTable({ scores }: LeaderboardTableProps) {
  if (!scores.length) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-sm text-slate-500 dark:text-slate-400 text-center">
        No scores yet. Play a round and claim the first spot!
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="max-h-[480px] overflow-y-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-[0.16em]">
            <tr>
              <th className="px-4 py-3 text-left">Rank</th>
              <th className="px-4 py-3 text-left">Player</th>
              <th className="px-4 py-3 text-right">Score</th>
              <th className="px-4 py-3 text-left">Difficulty</th>
              <th className="px-4 py-3 text-right">Date</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s, index) => {
              const date = new Date(s.createdAt);
              const formatted = date.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              });
              return (
                <tr
                  key={s.id}
                  className={
                    index === 0
                      ? 'bg-emerald-50/80 dark:bg-emerald-900/20 text-slate-900 dark:text-emerald-50'
                      : 'odd:bg-white even:bg-slate-50/40 dark:odd:bg-slate-900 dark:even:bg-slate-900/80 text-slate-800 dark:text-slate-100'
                  }
                >
                  <td className="px-4 py-2.5 align-middle text-xs font-semibold text-slate-500 dark:text-slate-400">
                    #{index + 1}
                  </td>
                  <td className="px-4 py-2.5 align-middle font-medium">{s.name}</td>
                  <td className="px-4 py-2.5 align-middle text-right tabular-nums">{s.score}</td>
                  <td className="px-4 py-2.5 align-middle text-xs capitalize text-slate-500 dark:text-slate-400">
                    {s.difficulty}
                  </td>
                  <td className="px-4 py-2.5 align-middle text-right text-xs text-slate-500 dark:text-slate-400">
                    {formatted}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
