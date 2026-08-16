"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";

type Message = {
  id: string;
  sender_kind: "agency" | "brand";
  body: string;
  created_at: string;
  sender_name: string | null;
};

type Props = {
  campaignId: string;
  packageToken?: string; // brand-side
  viewerKind: "agency" | "brand";
  viewerName?: string | null;
  initialMessages: Message[];
  pollIntervalMs?: number;
  // Server action for the composer. Receives a FormData with `body` +
  // any hidden fields (campaign_id or token) that the caller pre-wired.
  postAction: (formData: FormData) => Promise<void>;
  // Hidden fields the server action needs (campaign_id for agency,
  // token for brand). Rendered inside the composer form.
  hiddenFields: Record<string, string>;
};

export function MessageThread({
  campaignId,
  packageToken,
  viewerKind,
  viewerName = null,
  initialMessages,
  pollIntervalMs = 5000,
  postAction,
  hiddenFields,
}: Props) {
  const [serverMessages, setServerMessages] = useState<Message[]>(initialMessages);
  const [optimisticMessages, addOptimistic] = useOptimistic(
    serverMessages,
    (state, next: Message) => [...state, next],
  );
  const scrollerRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(initialMessages.length);
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  // Poll for updates so both sides see the other's messages without a page
  // reload. Optimistic entries above never conflict — the reconciled server
  // list replaces `serverMessages`, then useOptimistic layers pending sends
  // on top until they resolve.
  useEffect(() => {
    let cancelled = false;
    const qs = packageToken ? `?token=${encodeURIComponent(packageToken)}` : "";
    const url = `/api/campaigns/${campaignId}/messages${qs}`;

    async function poll() {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;
        const { messages: fresh } = (await res.json()) as { messages: Message[] };
        if (!cancelled) setServerMessages(fresh);
      } catch {
        // Swallow: next tick will resolve.
      }
    }

    const id = setInterval(poll, pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [campaignId, packageToken, pollIntervalMs]);

  useEffect(() => {
    if (optimisticMessages.length > lastCountRef.current) {
      scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
    }
    lastCountRef.current = optimisticMessages.length;
  }, [optimisticMessages.length]);

  function handleSubmit(formData: FormData) {
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return;

    startTransition(async () => {
      addOptimistic({
        id: `optimistic-${Date.now()}`,
        sender_kind: viewerKind,
        body,
        created_at: new Date().toISOString(),
        sender_name: viewerName,
      });
      formRef.current?.reset();
      try {
        await postAction(formData);
      } catch {
        // Server error surfaces via next poll not showing the message.
        // Failure is silent for now — future toast surface.
      }
    });
  }

  return (
    <>
      <div
        ref={scrollerRef}
        className="max-h-96 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
      >
        {optimisticMessages.length === 0 ? (
          <p className="p-6 text-center text-sm text-zinc-500">
            No messages yet. Start the conversation below.
          </p>
        ) : (
          <ul className="space-y-3">
            {optimisticMessages.map((m) => {
              const mine = m.sender_kind === viewerKind;
              const isOptimistic = m.id.startsWith("optimistic-");
              return (
                <li
                  key={m.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-2 text-sm transition-opacity ${
                      m.sender_kind === "agency"
                        ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                        : "bg-blue-100 text-blue-900 dark:bg-blue-950/40 dark:text-blue-100"
                    } ${isOptimistic ? "opacity-60" : ""}`}
                  >
                    <div className="text-[10px] font-medium uppercase tracking-wide opacity-70">
                      {m.sender_kind}
                      {m.sender_name ? ` · ${m.sender_name}` : ""} ·{" "}
                      {isOptimistic
                        ? "sending…"
                        : new Date(m.created_at).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form
        ref={formRef}
        action={handleSubmit}
        className="mt-3 flex items-start gap-2"
      >
        {Object.entries(hiddenFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <textarea
          name="body"
          rows={2}
          required
          maxLength={4000}
          placeholder={
            viewerKind === "brand" ? "Write to the agency…" : "Reply to the brand…"
          }
          className="input flex-1"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Sending…" : "Send"}
        </button>
      </form>
    </>
  );
}

