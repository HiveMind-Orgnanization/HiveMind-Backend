export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="h-8 w-8 border-2 border-slate-300 border-t-primary rounded-full animate-spin" aria-label="Loading" />
    </div>
  );
}
