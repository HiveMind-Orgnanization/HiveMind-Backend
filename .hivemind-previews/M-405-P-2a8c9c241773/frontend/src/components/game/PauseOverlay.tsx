interface PauseOverlayProps {
  status: 'idle' | 'running' | 'paused' | 'over';
}

export function PauseOverlay({ status }: PauseOverlayProps) {
  if (status === 'running') return null;

  const label =
    status === 'idle'
      ? 'Press any arrow key or use the D-pad to start'
      : status === 'paused'
      ? 'Paused'
      : status === 'over'
      ? 'Game Over'
      : '';

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="rounded-2xl bg-slate-900/60 text-slate-50 px-4 py-2 text-xs sm:text-sm">
        {label}
      </div>
    </div>
  );
}
