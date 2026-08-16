export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse px-6 py-10">
      <div className="h-8 w-72 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-3 h-4 w-96 rounded bg-zinc-100 dark:bg-zinc-900" />
      <div className="mt-6 h-24 rounded-lg bg-zinc-100 dark:bg-zinc-900" />
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-zinc-100 dark:bg-zinc-900" />
        ))}
      </div>
      <div className="mt-6 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 rounded-lg bg-zinc-100 dark:bg-zinc-900" />
        ))}
      </div>
    </div>
  );
}
