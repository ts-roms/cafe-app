export default function Loading() {
  return (
    <div className="max-w-lg mx-auto space-y-4 animate-pulse">
      <div className="h-7 w-40 bg-foreground/10 dark:bg-white/10 rounded" />
      <div className="grid gap-3 p-4 border rounded">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <div className="h-4 w-24 bg-foreground/10 dark:bg-white/10 rounded" />
            <div className="h-10 w-full bg-foreground/10 dark:bg-white/10 rounded" />
          </div>
        ))}dsadsdsdsadsads
        <div className="h-10 bg-foreground/10 dark:bg-white/10 rounded" />
      </div>
    </div>
  );
}
