import Link from "next/link";
import type { ReactNode } from "react";
import { logOutAction } from "@/app/(auth)/actions";

type NavItem = { href: string; label: string; badge?: number };

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function PersonaShell({
  persona,
  nav,
  user,
  children,
}: {
  persona: "Agency" | "Brand" | "Influencer";
  nav: NavItem[];
  user: { fullName: string; email: string };
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <aside
        style={{ viewTransitionName: "agency-shell" }}
        className="fixed inset-y-0 left-0 flex w-60 flex-col border-r bg-[var(--surface)] px-3 py-4 hairline"
      >
        {/* Workspace switcher pill — the Linear signature top-left. */}
        <div className="flex items-center gap-2 rounded-md border px-2 py-1.5 hairline">
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[var(--accent)] text-[10px] font-semibold text-white"
            aria-hidden
          >
            {initials(user.fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium leading-tight">
              PR Platform
            </p>
            <p className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--subtle)]">
              {persona}
            </p>
          </div>
        </div>

        <nav className="mt-4 flex flex-col gap-px text-[13px]">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center justify-between rounded-md px-2 py-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)]"
            >
              <span>{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span className="ml-2 rounded bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular text-white">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="mt-auto border-t hairline pt-3">
          <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-900 to-zinc-700 text-[10px] font-semibold text-white dark:from-zinc-100 dark:to-zinc-300 dark:text-zinc-900"
              aria-hidden
            >
              {initials(user.fullName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium leading-tight">
                {user.fullName}
              </p>
              <p className="truncate text-[10px] text-[var(--subtle)]">
                {user.email}
              </p>
            </div>
            <form action={logOutAction}>
              <button
                type="submit"
                title="Log out"
                className="rounded p-1 text-[var(--subtle)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)]"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" x2="9" y1="12" y2="12" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="ml-60">
        <div className="mx-auto max-w-6xl px-10 py-10">{children}</div>
      </main>
    </div>
  );
}
