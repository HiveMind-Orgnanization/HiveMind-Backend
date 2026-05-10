import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, Save } from "lucide-react";
import { useToast } from "./Toast";

export function SettingsPage() {
  const [difficulty, setDifficulty] = useState<"easy" | "normal" | "hard">("normal");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [saving, setSaving] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    const storedDifficulty = window.localStorage.getItem("snake-difficulty");
    if (storedDifficulty === "easy" || storedDifficulty === "normal" || storedDifficulty === "hard") {
      setDifficulty(storedDifficulty);
    }
    const storedSound = window.localStorage.getItem("snake-sound-enabled");
    if (storedSound === "true" || storedSound === "false") {
      setSoundEnabled(storedSound === "true");
    }
    const storedTheme = window.localStorage.getItem("snake-theme");
    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
    }
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    window.localStorage.setItem("snake-difficulty", difficulty);
    window.localStorage.setItem("snake-sound-enabled", String(soundEnabled));
    window.localStorage.setItem("snake-theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
    setTimeout(() => {
      setSaving(false);
      showToast("Settings saved");
    }, 400);
  };

  const handleReset = () => {
    if (!resetConfirm) {
      setResetConfirm(true);
      return;
    }
    window.localStorage.removeItem("snake-best-score");
    window.localStorage.removeItem("snake-difficulty");
    window.localStorage.removeItem("snake-sound-enabled");
    showToast("Progress reset", "success");
    setResetConfirm(false);
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50 mb-1">
          Settings
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Tune the game to your style. Settings are stored locally in this browser.
        </p>
      </div>

      <section className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Difficulty
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Adjust snake speed and grid density.
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
          {([
            ["easy", "Easy"],
            ["normal", "Normal"],
            ["hard", "Hard"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setDifficulty(value)}
              className={`rounded-xl border px-3 py-2 font-medium transition-colors ${
                difficulty === value
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-500"
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Audio & theme
        </h2>
        <div className="mt-2 space-y-3 text-sm">
          <label className="flex items-center justify-between gap-3">
            <span className="text-slate-700 dark:text-slate-200">Sound effects</span>
            <button
              type="button"
              onClick={() => setSoundEnabled((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full border px-0.5 transition-colors ${
                soundEnabled
                  ? "border-emerald-500 bg-emerald-500/20"
                  : "border-slate-400 bg-slate-200 dark:border-slate-600 dark:bg-slate-700"
              }`}
              aria-pressed={soundEnabled}
            >
              <span
                className={`h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                  soundEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="text-slate-700 dark:text-slate-200">Dark mode</span>
            <button
              type="button"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full border px-0.5 transition-colors ${
                theme === "dark"
                  ? "border-slate-900 bg-slate-900"
                  : "border-slate-300 bg-slate-200"
              }`}
              aria-pressed={theme === "dark"}
            >
              <span
                className={`h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                  theme === "dark" ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-red-200 dark:border-red-900 bg-red-50/70 dark:bg-red-950/40 p-4">
        <h2 className="text-sm font-semibold text-red-800 dark:text-red-200">
          Reset progress
        </h2>
        <p className="text-xs text-red-700 dark:text-red-300 flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
          This clears your best score and local preferences. It does not remove scores already saved to the leaderboard.
        </p>
        <button
          type="button"
          onClick={handleReset}
          className="mt-2 inline-flex items-center gap-1 rounded-lg border border-red-300 dark:border-red-800 bg-red-100/70 dark:bg-red-900/40 px-3 py-1.5 text-xs font-medium text-red-800 dark:text-red-100 hover:bg-red-200/80 dark:hover:bg-red-900/60"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          {resetConfirm ? "Click again to confirm" : "Reset local data"}
        </button>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save settings"}
        </button>
      </div>
    </form>
  );
}
