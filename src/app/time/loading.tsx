export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 w-40 bg-foreground/10 dark:bg-white/10 rounded" />
      <div className="p-4 border rounded space-y-3">
        <div className="h-5 w-52 bg-foreground/10 dark:bg-white/10 rounded" />
        <div className="grid gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 w-full bg-foreground/10 dark:bg-white/10 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
