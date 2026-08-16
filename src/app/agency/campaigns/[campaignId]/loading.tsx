export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div>
        <div className="h-7 w-64 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-2 h-4 w-40 rounded bg-zinc-100 dark:bg-zinc-900" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-zinc-100 dark:bg-zinc-900" />
        ))}
      </div>
      <div>
        <div className="mb-3 h-5 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-zinc-100 dark:bg-zinc-900" />
          ))}
        </div>
      </div>
    </div>
  );
}
