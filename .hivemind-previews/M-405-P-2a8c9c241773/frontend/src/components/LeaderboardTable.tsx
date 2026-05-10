import { useEffect, useState } from "react";
import { Trophy, AlertCircle } from "lucide-react";
import { LoadingSpinner } from "./LoadingSpinner";

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  createdAt: string;
}

export function LeaderboardTable() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "week">("all");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/leaderboard`);
        if (!res.ok) throw new Error("Failed to load leaderboard");
        const data = await res.json();
        const list: LeaderboardEntry[] = Array.isArray(data) ? data : data.items || [];
        setEntries(list);
      } catch (err) {
        console.error(err);
        setError("Unable to load leaderboard. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredEntries = entries.filter((entry) => {
    if (filter === "all") return true;
    const created = new Date(entry.createdAt).getTime();
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return created >= weekAgo;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-full bg-amber-400/20 flex items-center justify-center border border-amber-400/40">
            <Trophy className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              Global leaderboard
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Top snake runs saved from this browser session.
            </p>
          </div>
        </div>
        <div className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 p-1 text-xs">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-3 py-1 rounded-full font-medium ${
              filter === "all"
                ? "bg-white dark:bg-slate-900 shadow text-slate-900 dark:text-slate-50"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            All-time
          </button>
          <button
            type="button"
            onClick={() => setFilter("week")}
            className={`px-3 py-1 rounded-full font-medium ${
              filter === "week"
                ? "bg-white dark:bg-slate-900 shadow text-slate-900 dark:text-slate-50"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            This week
          </button>
        </div>
      </div>

      {loading && <LoadingSpinner label="Loading leaderboard" />}

      {error && !loading && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-900 bg-red-50/70 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-200">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Rank</th>
                <th className="px-4 py-2 text-left font-medium">Player</th>
                <th className="px-4 py-2 text-right font-medium">Score</th>
                <th className="px-4 py-2 text-right font-medium hidden sm:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-xs text-slate-500 dark:text-slate-400"
                  >
                    No scores yet. Play a game and save your first run.
                  </td>
                </tr>
              )}
              {filteredEntries.map((entry, index) => (
                <tr
                  key={entry.id}
                  className={
                    index === 0
                      ? "bg-amber-50/60 dark:bg-amber-950/20"
                      : index % 2 === 0
                      ? "bg-white dark:bg-slate-900"
                      : "bg-slate-50/60 dark:bg-slate-900/80"
                  }
                >
                  <td className="px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    #{index + 1}
                  </td>
                  <td className="px-4 py-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                    {entry.name}
                  </td>
                  <td className="px-4 py-2 text-sm text-right font-semibold text-slate-900 dark:text-slate-50 tabular-nums">
                    {entry.score}
                  </td>
                  <td className="px-4 py-2 text-xs text-right text-slate-500 dark:text-slate-400 hidden sm:table-cell">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
