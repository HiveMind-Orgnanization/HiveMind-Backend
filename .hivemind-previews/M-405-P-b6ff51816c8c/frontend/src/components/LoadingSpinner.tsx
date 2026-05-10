export function LoadingSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-slate-500 dark:text-slate-400">
      <div className="h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}
