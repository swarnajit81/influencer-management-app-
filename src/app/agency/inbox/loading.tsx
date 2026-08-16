export default function Loading() {
  return (
    <div className="animate-pulse space-y-4">
      <div>
        <div className="h-7 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-2 h-4 w-72 rounded bg-zinc-100 dark:bg-zinc-900" />
      </div>
      <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-start justify-between gap-4 px-4 py-3">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded bg-zinc-100 dark:bg-zinc-800" />
              <div className="h-3 w-1/3 rounded bg-zinc-100 dark:bg-zinc-800" />
            </div>
            <div className="h-3 w-12 rounded bg-zinc-100 dark:bg-zinc-800" />
          </div>
        ))}
      </div>
    </div>
  );
}
