import { Link } from "react-router-dom";
import { Play, Trophy, Settings2 } from "lucide-react";

export function HomePage() {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-center">
      <section className="space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/70 dark:border-emerald-900/70 bg-emerald-50/60 dark:bg-emerald-950/40 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live arcade · Smooth 60fps snake
        </div>
        <div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 mb-3">
            Glide through the grid.
          </h1>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-xl">
            A modern take on the classic Snake arcade. Fluid controls, adaptive difficulty, and an online leaderboard that remembers your best runs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/game"
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-2.5 text-sm sm:text-base font-semibold text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <Play className="h-4 w-4" />
            Play now
          </Link>
          <Link
            to="/leaderboard"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 px-5 py-2.5 text-sm sm:text-base font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <Trophy className="h-4 w-4 text-amber-400" />
            View leaderboard
          </Link>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Difficulty modes & persistent best score
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            Touch-optimized mobile controls
          </div>
        </div>
      </section>

      <section className="relative h-[260px] sm:h-[320px] lg:h-[360px]">
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-2xl overflow-hidden">
          <div className="absolute -inset-24 bg-[radial-gradient(circle_at_top,_#22c55e33,_transparent_60%),_radial-gradient(circle_at_bottom,_#0ea5e933,_transparent_60%)]" />
          <div className="relative h-full p-4 sm:p-6 flex flex-col">
            <div className="flex items-center justify-between text-xs text-slate-300 mb-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/60 px-2 py-1 border border-slate-700/60">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live preview
              </span>
              <span className="rounded-full bg-slate-900/60 px-2 py-1 border border-slate-700/60">
                60 fps
              </span>
            </div>
            <div className="relative flex-1 rounded-2xl border border-slate-700/70 bg-slate-900/80 overflow-hidden">
              <div className="absolute inset-3 grid grid-cols-12 grid-rows-12 gap-[2px]">
                {Array.from({ length: 144 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-[3px] bg-slate-800/80 border border-slate-900/60"
                  />
                ))}
              </div>
              <div className="absolute inset-3">
                <div className="absolute left-[16%] top-[40%] flex gap-[2px]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-4 w-4 sm:h-5 sm:w-5 rounded-[4px] bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.8)]"
                    />
                  ))}
                </div>
                <div className="absolute right-[18%] top-[32%] h-4 w-4 sm:h-5 sm:w-5 rounded-[4px] bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)]" />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-300">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-slate-400">Score</span>
                  <span className="font-semibold text-emerald-400">1280</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-slate-400">Best</span>
                  <span className="font-semibold text-sky-400">3420</span>
                </div>
              </div>
              <Link
                to="/settings"
                className="inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-2.5 py-1 border border-slate-700/70 hover:bg-slate-800/80"
              >
                <Settings2 className="h-3 w-3" />
                Tune difficulty
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
