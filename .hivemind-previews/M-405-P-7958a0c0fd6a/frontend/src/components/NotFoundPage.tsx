import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="max-w-md mx-auto text-center mt-16 space-y-4">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-emerald-400 text-xl font-bold shadow-lg">
        404
      </div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
        Lost in the grid
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        The page you are looking for doesn’t exist. Head back to the arcade lobby and start a new run.
      </p>
      <div className="flex justify-center gap-3 text-sm">
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 font-semibold text-white shadow hover:bg-emerald-600"
        >
          Back home
        </Link>
        <Link
          to="/game"
          className="inline-flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 px-4 py-2 font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Play snake
        </Link>
      </div>
    </div>
  );
}
