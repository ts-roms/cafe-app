export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 w-48 bg-foreground/10 dark:bg-white/10 rounded" />
      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`h-8 w-24 rounded ${i === 0 ? 'bg-foreground/20 dark:bg-white/20' : 'bg-foreground/10 dark:bg-white/10'}`} />
        ))}
      </div>
      <div className="p-4 border rounded space-y-2">
        <div className="h-5 w-56 bg-foreground/10 dark:bg-white/10 rounded" />
        <div className="grid sm:grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-foreground/10 dark:bg-white/10 rounded" />
          ))}
        </div>
        <div className="h-10 bg-foreground/10 dark:bg-white/10 rounded" />
      </div>
    </div>
  );
}
