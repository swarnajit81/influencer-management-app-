import Link from "next/link";
import type { ReactNode } from "react";
import { logOutAction } from "@/app/(auth)/actions";

type NavItem = { href: string; label: string };

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
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <aside
        style={{ viewTransitionName: "agency-shell" }}
        className="fixed inset-y-0 left-0 flex w-56 flex-col border-r border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <Link href="/" className="text-sm font-semibold tracking-tight">
          PR Platform
        </Link>
        <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">{persona}</p>

        <nav className="mt-6 flex flex-col gap-1 text-sm">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <p className="truncate text-sm font-medium">{user.fullName}</p>
          <p className="truncate text-xs text-zinc-500">{user.email}</p>
          <form action={logOutAction} className="mt-3">
            <button
              type="submit"
              className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Log out
            </button>
          </form>
        </div>
      </aside>
      <main className="ml-56 px-8 py-10">{children}</main>
    </div>
  );
}
