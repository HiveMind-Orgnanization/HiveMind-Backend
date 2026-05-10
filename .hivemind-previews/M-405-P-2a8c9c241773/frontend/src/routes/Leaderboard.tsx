import { useEffect, useState } from 'react';
import { fetchLeaderboard, LeaderboardScore } from '../lib/api';
import { LeaderboardTable } from '../components/leaderboard/LeaderboardTable';
import { FilterTabs } from '../components/leaderboard/FilterTabs';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../components/ui/Toast';

export function Leaderboard() {
  const [scores, setScores] = useState<LeaderboardScore[]>([]);
  const [range, setRange] = useState<'all' | 'week'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchLeaderboard(range)
      .then((data) => {
        if (!cancelled) setScores(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load leaderboard');
          showToast('Failed to load leaderboard');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, showToast]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            See how your best run stacks up against other players.
          </p>
        </div>
        <FilterTabs value={range} onChange={setRange} />
      </div>

      {loading && <LoadingSpinner />}
      {!loading && error && (
        <div className="rounded-lg border border-red-300/60 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-200 px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {!loading && !error && <LeaderboardTable scores={scores} />}
    </div>
  );
}
