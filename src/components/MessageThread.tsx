"use client";

import { useEffect, useRef, useState } from "react";

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
  initialMessages: Message[];
  pollIntervalMs?: number;
};

export function MessageThread({
  campaignId,
  packageToken,
  viewerKind,
  initialMessages,
  pollIntervalMs = 5000,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(initialMessages.length);

  useEffect(() => {
    let cancelled = false;
    const qs = packageToken ? `?token=${encodeURIComponent(packageToken)}` : "";
    const url = `/api/campaigns/${campaignId}/messages${qs}`;

    async function poll() {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;
        const { messages: fresh } = (await res.json()) as { messages: Message[] };
        if (!cancelled) setMessages(fresh);
      } catch {
        // Swallow: network hiccups will resolve on the next tick.
      }
    }

    const id = setInterval(poll, pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [campaignId, packageToken, pollIntervalMs]);

  useEffect(() => {
    if (messages.length > lastCountRef.current) {
      scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
    }
    lastCountRef.current = messages.length;
  }, [messages.length]);

  return (
    <div
      ref={scrollerRef}
      className="max-h-96 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
    >
      {messages.length === 0 ? (
        <p className="p-6 text-center text-sm text-zinc-500">
          No messages yet. Start the conversation below.
        </p>
      ) : (
        <ul className="space-y-3">
          {messages.map((m) => {
            const mine = m.sender_kind === viewerKind;
            return (
              <li
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                    m.sender_kind === "agency"
                      ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                      : "bg-blue-100 text-blue-900 dark:bg-blue-950/40 dark:text-blue-100"
                  }`}
                >
                  <div className="text-[10px] font-medium uppercase tracking-wide opacity-70">
                    {m.sender_kind}
                    {m.sender_name ? ` · ${m.sender_name}` : ""} ·{" "}
                    {new Date(m.created_at).toLocaleTimeString("en-IN", {
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
  );
}
