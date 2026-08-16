"use client";

import { useOptimistic, useRef, useTransition } from "react";

type Decision = "pending" | "approved" | "rejected";

type State = {
  decision: Decision;
  comment: string | null;
};

type Props = {
  itemId: string;
  token: string;
  initial: State;
  postAction: (formData: FormData) => Promise<void>;
};

export function BrandDecisionForm({ itemId, token, initial, postAction }: Props) {
  const [state, setOptimistic] = useOptimistic<State, State>(
    initial,
    (_prev, next) => next,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  const handle = (decision: "approved" | "rejected") => (formData: FormData) => {
    const comment = String(formData.get("brand_comment") ?? "").trim() || null;
    formData.set("decision", decision);

    startTransition(async () => {
      setOptimistic({ decision, comment });
      try {
        await postAction(formData);
      } catch {
        // Failure — revert on next server round-trip.
      }
    });
  };

  if (state.decision !== "pending") {
    return (
      <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <StatusPill decision={state.decision} />
        {state.comment && (
          <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm dark:bg-amber-950/40">
            <div className="text-xs font-medium uppercase tracking-wide text-amber-900 dark:text-amber-300">
              Your comment
            </div>
            <p className="mt-1 whitespace-pre-wrap text-amber-900 dark:text-amber-200">
              {state.comment}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      className="mt-4 space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800"
    >
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="item_id" value={itemId} />
      <textarea
        name="brand_comment"
        rows={2}
        placeholder="Comment (optional — required for reject)"
        className="input"
        disabled={pending}
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const fd = new FormData(formRef.current!);
            handle("approved")(fd);
          }}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Approve"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const fd = new FormData(formRef.current!);
            handle("rejected")(fd);
          }}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Reject
        </button>
      </div>
    </form>
  );
}

function StatusPill({ decision }: { decision: Decision }) {
  const styles: Record<Decision, string> = {
    pending: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    rejected: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${styles[decision]}`}
    >
      {decision}
    </span>
  );
}
