export default function Loading() {
  // Global suspense fallback for route transitions and initial page load
  return (
    <div className="max-w-md mx-auto space-y-4 animate-pulse">
      <div className="h-6 w-40 bg-foreground/10 dark:bg-white/10 rounded" />
      <div className="p-4 border rounded space-y-3">
        <div className="h-4 w-3/4 bg-foreground/10 dark:bg-white/10 rounded" />
        <div className="h-4 w-1/2 bg-foreground/10 dark:bg-white/10 rounded" />
      </div>
    </div>
  );
}
