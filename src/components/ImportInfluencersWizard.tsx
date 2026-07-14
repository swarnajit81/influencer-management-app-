"use client";

import { useMemo, useState, useTransition } from "react";
import { importInfluencersAction } from "@/app/(auth)/actions";

const TARGET_FIELDS = [
  { key: "display_name", label: "Display name", required: true },
  { key: "instagram_handle", label: "Instagram handle", required: false },
  { key: "youtube_handle", label: "YouTube handle", required: false },
  { key: "twitter_handle", label: "Twitter handle", required: false },
  { key: "follower_count_total", label: "Followers", required: false },
  { key: "engagement_rate", label: "Engagement %", required: false },
  { key: "city", label: "City", required: false },
  { key: "contact_email", label: "Contact email", required: false },
  { key: "contact_phone", label: "Contact phone", required: false },
  { key: "categories", label: "Categories (comma-sep)", required: false },
] as const;

type TargetKey = (typeof TARGET_FIELDS)[number]["key"];

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        field = "";
        if (row.some((c) => c.length > 0)) rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((c) => c.length > 0)) rows.push(row);
  }
  return rows;
}

function guessMapping(header: string): TargetKey | "" {
  const h = header.toLowerCase().trim();
  if (/name|creator|influencer/.test(h) && !/user|handle/.test(h)) return "display_name";
  if (/insta|ig/.test(h)) return "instagram_handle";
  if (/you.?tube|yt/.test(h)) return "youtube_handle";
  if (/twitter|^x$|x.?handle/.test(h)) return "twitter_handle";
  if (/follow/.test(h)) return "follower_count_total";
  if (/engage/.test(h)) return "engagement_rate";
  if (/city|location/.test(h)) return "city";
  if (/e-?mail/.test(h)) return "contact_email";
  if (/phone|mobile|whatsapp/.test(h)) return "contact_phone";
  if (/categor|niche|tag/.test(h)) return "categories";
  return "";
}

export function ImportInfluencersWizard() {
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState<string[][] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<number, TargetKey | "">>({});
  const [pending, startTransition] = useTransition();

  function handleParse() {
    const grid = parseCsv(rawText);
    if (grid.length < 1) {
      setParsed(null);
      return;
    }
    const [head, ...rest] = grid;
    setHeaders(head);
    setParsed(rest);
    const guess: Record<number, TargetKey | ""> = {};
    head.forEach((h, idx) => {
      guess[idx] = guessMapping(h);
    });
    setMapping(guess);
  }

  const preview = useMemo(() => {
    if (!parsed) return [];
    return parsed.slice(0, 5).map((row) => buildRow(row, headers, mapping));
  }, [parsed, headers, mapping]);

  const rowsToImport = useMemo(() => {
    if (!parsed) return [];
    return parsed.map((row) => buildRow(row, headers, mapping));
  }, [parsed, headers, mapping]);

  const displayNameMapped = Object.values(mapping).includes("display_name");
  const canSubmit = parsed !== null && parsed.length > 0 && displayNameMapped;

  function handleSubmit() {
    const fd = new FormData();
    fd.set("rows_json", JSON.stringify(rowsToImport));
    startTransition(() => {
      importInfluencersAction(fd);
    });
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-semibold">Step 1 — Paste CSV</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Save your Excel as CSV, then paste the contents here. First row should be
          the header.
        </p>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={8}
          className="input mt-3 font-mono text-xs"
          placeholder={`Creator,Instagram,Followers,City,Categories\nRhea Kapoor,rheakapoor,250000,Mumbai,"beauty, skincare"`}
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleParse}
            disabled={!rawText.trim()}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Parse
          </button>
          {parsed && (
            <span className="text-sm text-zinc-500 self-center">
              Found {parsed.length} row{parsed.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </section>

      {parsed && parsed.length > 0 && (
        <>
          <section>
            <h2 className="font-semibold">Step 2 — Map columns</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Match each column to a creator field. Unmapped columns are ignored.{" "}
              <strong>Display name is required.</strong>
            </p>
            <div className="mt-3 space-y-2">
              {headers.map((h, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-64 truncate rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                    {h || <em className="text-zinc-400">(empty header)</em>}
                  </div>
                  <span className="text-zinc-400">→</span>
                  <select
                    value={mapping[idx] ?? ""}
                    onChange={(e) =>
                      setMapping({ ...mapping, [idx]: e.target.value as TargetKey | "" })
                    }
                    className="input w-64"
                  >
                    <option value="">— Ignore —</option>
                    {TARGET_FIELDS.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                        {f.required ? " *" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {!displayNameMapped && (
              <p className="mt-3 text-sm text-red-600">
                Map at least one column to <strong>Display name</strong> to continue.
              </p>
            )}
          </section>

          <section>
            <h2 className="font-semibold">Step 3 — Preview</h2>
            {preview.length > 0 ? (
              <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Name</th>
                      <th className="px-3 py-2 text-left font-medium">IG</th>
                      <th className="px-3 py-2 text-left font-medium">Followers</th>
                      <th className="px-3 py-2 text-left font-medium">City</th>
                      <th className="px-3 py-2 text-left font-medium">Categories</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {preview.map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2">{r.display_name || <em className="text-red-500">missing</em>}</td>
                        <td className="px-3 py-2">{r.instagram_handle ?? "—"}</td>
                        <td className="px-3 py-2">
                          {Number(r.follower_count_total ?? 0).toLocaleString("en-IN")}
                        </td>
                        <td className="px-3 py-2">{r.city ?? "—"}</td>
                        <td className="px-3 py-2">{(r.categories ?? []).join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.length > 5 && (
                  <p className="border-t border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
                    Showing 5 of {parsed.length} rows.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">No rows to preview.</p>
            )}
          </section>

          <section>
            <button
              type="button"
              disabled={!canSubmit || pending}
              onClick={handleSubmit}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {pending ? "Importing…" : `Import ${parsed.length} row${parsed.length === 1 ? "" : "s"}`}
            </button>
            <p className="mt-2 text-xs text-zinc-500">
              Duplicates (same Instagram handle already on your roster) will be skipped.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function buildRow(
  row: string[],
  headers: string[],
  mapping: Record<number, TargetKey | "">,
) {
  const out: {
    display_name: string;
    instagram_handle: string | null;
    youtube_handle: string | null;
    twitter_handle: string | null;
    follower_count_total: number;
    engagement_rate: number | null;
    city: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    categories: string[];
  } = {
    display_name: "",
    instagram_handle: null,
    youtube_handle: null,
    twitter_handle: null,
    follower_count_total: 0,
    engagement_rate: null,
    city: null,
    contact_email: null,
    contact_phone: null,
    categories: [],
  };
  for (let i = 0; i < headers.length; i++) {
    const key = mapping[i];
    if (!key) continue;
    const raw = (row[i] ?? "").trim();
    if (raw === "") continue;
    switch (key) {
      case "display_name":
        out.display_name = raw;
        break;
      case "instagram_handle":
        out.instagram_handle = raw.replace(/^@+/, "");
        break;
      case "youtube_handle":
        out.youtube_handle = raw.replace(/^@+/, "");
        break;
      case "twitter_handle":
        out.twitter_handle = raw.replace(/^@+/, "");
        break;
      case "follower_count_total": {
        const n = Number(raw.replace(/[,_\s]/g, ""));
        out.follower_count_total = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
        break;
      }
      case "engagement_rate": {
        const n = Number(raw.replace(/%/g, "").trim());
        out.engagement_rate = Number.isFinite(n) ? n : null;
        break;
      }
      case "city":
        out.city = raw;
        break;
      case "contact_email":
        out.contact_email = raw.toLowerCase();
        break;
      case "contact_phone":
        out.contact_phone = raw;
        break;
      case "categories":
        out.categories = raw
          .split(/[,;|]/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 20);
        break;
    }
  }
  return out;
}
