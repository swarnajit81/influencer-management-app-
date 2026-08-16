export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div>
        <div className="h-7 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-2 h-4 w-64 rounded bg-zinc-100 dark:bg-zinc-900" />
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-zinc-100 dark:bg-zinc-900" />
        ))}
      </div>
      <div className="h-64 rounded-lg bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}
