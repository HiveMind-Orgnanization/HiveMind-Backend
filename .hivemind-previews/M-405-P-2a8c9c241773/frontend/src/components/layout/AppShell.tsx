import { ReactNode, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { ThemeToggle } from '../ThemeToggle';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [open, setOpen] = useState(false);

  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-primary text-slate-900 shadow-sm'
        : 'text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
    }`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex flex-col">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shadow-md">
              <span className="text-slate-900 font-black text-lg">S</span>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-semibold tracking-tight">Snake Neo</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-[0.18em]">
                Arcade
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-2">
            <NavLink to="/" className={navLinkClasses} end>
              Home
            </NavLink>
            <NavLink to="/game" className={navLinkClasses}>
              Play
            </NavLink>
            <NavLink to="/leaderboard" className={navLinkClasses}>
              Leaderboard
            </NavLink>
            <NavLink to="/settings" className={navLinkClasses}>
              Settings
            </NavLink>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus-ring"
              aria-label="Toggle navigation menu"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <nav className="px-4 py-3 space-y-1">
              <NavLink to="/" className={navLinkClasses} end onClick={() => setOpen(false)}>
                Home
              </NavLink>
              <NavLink to="/game" className={navLinkClasses} onClick={() => setOpen(false)}>
                Play
              </NavLink>
              <NavLink to="/leaderboard" className={navLinkClasses} onClick={() => setOpen(false)}>
                Leaderboard
              </NavLink>
              <NavLink to="/settings" className={navLinkClasses} onClick={() => setOpen(false)}>
                Settings
              </NavLink>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">{children}</div>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
        Snake Neo · Built with React &amp; Node
      </footer>
    </div>
  );
}
