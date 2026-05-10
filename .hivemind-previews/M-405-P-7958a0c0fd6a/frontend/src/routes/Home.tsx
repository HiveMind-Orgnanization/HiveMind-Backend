import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export function Home() {
  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-center">
      <div className="space-y-6">
        <div className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <span className="mr-1 h-2 w-2 rounded-full bg-emerald-500" />
          Live arcade · Snake Neo
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
          A modern take on the classic <span className="text-primary">Snake</span>.
        </h1>
        <p className="text-slate-600 dark:text-slate-300 max-w-xl">
          Glide through a neon grid, chase glowing food, and climb the global leaderboard. Smooth controls, crisp
          visuals, and difficulty modes tuned for both casual players and high-score hunters.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link to="/game">
            <Button className="px-6 py-2.5 text-base">Play Now</Button>
          </Link>
          <Link to="/leaderboard">
            <Button variant="secondary" className="px-5 py-2.5 text-base">
              View Leaderboard
            </Button>
          </Link>
          <Link to="/settings">
            <Button variant="ghost" className="px-4 py-2.5 text-base">
              Settings
            </Button>
          </Link>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div>
            • Difficulty modes · Easy / Normal / Hard
          </div>
          <div>• Mobile touch controls</div>
          <div>• Sound effects &amp; dark mode</div>
        </div>
      </div>

      <div className="relative h-[260px] sm:h-[320px] md:h-[360px]">
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-emerald-400 via-secondary to-slate-900 opacity-80" />
        <div className="absolute inset-[10%] rounded-3xl bg-slate-950/80 border border-emerald-300/40 shadow-2xl overflow-hidden flex items-center justify-center">
          <div className="grid grid-cols-8 grid-rows-8 gap-[2px] w-full h-full p-4">
            {Array.from({ length: 64 }).map((_, i) => (
              <div
                key={i}
                className="rounded-sm bg-slate-900/80 border border-slate-800/60 relative overflow-hidden"
              >
                {i === 27 && <div className="absolute inset-0 bg-emerald-400/80" />}
                {i === 28 && <div className="absolute inset-0 bg-emerald-500/80" />}
                {i === 29 && <div className="absolute inset-0 bg-emerald-600/80" />}
                {i === 38 && <div className="absolute inset-[30%] rounded-full bg-accent shadow-[0_0_12px_rgba(248,180,84,0.9)]" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
