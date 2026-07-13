import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAgencyMember } from "@/lib/auth/getCurrentUser";
import { updateCampaignAction } from "@/app/(auth)/actions";
import { SubmitButton } from "@/components/SubmitButton";

const STATUSES: Array<{ value: string; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export default async function EditCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { campaignId } = await params;
  const { error } = await searchParams;
  const user = await requireAgencyMember();

  const supabase = await createSupabaseServerClient();
  const { data: campaign } = await supabase
    .from("campaigns")
    .select(
      "id, name, brief, total_budget_inr_paise, start_date, end_date, status, brands (name)",
    )
    .eq("id", campaignId)
    .eq("agency_id", user.agencyId)
    .single();

  if (!campaign) notFound();

  const c = campaign as {
    id: string;
    name: string;
    brief: string | null;
    total_budget_inr_paise: number;
    start_date: string | null;
    end_date: string | null;
    status: string;
    brands: { name: string } | { name: string }[] | null;
  };
  const brand = Array.isArray(c.brands) ? c.brands[0] : c.brands;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/agency/campaigns/${campaignId}`}
        transitionTypes={["nav-back"]}
        className="mb-6 inline-block text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Back to campaign
      </Link>

      <h1 className="text-2xl font-semibold">Edit campaign</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Brand: <span className="font-medium">{brand?.name ?? "—"}</span>{" "}
        (brand can&apos;t be changed).
      </p>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {decodeURIComponent(error)}
        </div>
      )}

      <form action={updateCampaignAction} className="mt-8 space-y-6">
        <input type="hidden" name="campaign_id" value={campaignId} />

        <Field label="Campaign name" required>
          <input
            name="name"
            type="text"
            className="input"
            defaultValue={c.name}
            required
          />
        </Field>

        <Field label="Brief">
          <textarea
            name="brief"
            rows={4}
            className="input"
            defaultValue={c.brief ?? ""}
          />
        </Field>

        <Field label="Total budget (₹)" required>
          <input
            name="budget_rupees"
            type="number"
            step="100"
            min="0"
            className="input"
            defaultValue={Math.round((c.total_budget_inr_paise ?? 0) / 100)}
            required
          />
        </Field>

        <Field label="Status" required>
          <select name="status" className="input" defaultValue={c.status} required>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Start date">
            <input
              name="start_date"
              type="date"
              className="input"
              defaultValue={c.start_date ?? ""}
            />
          </Field>
          <Field label="End date">
            <input
              name="end_date"
              type="date"
              className="input"
              defaultValue={c.end_date ?? ""}
            />
          </Field>
        </div>

        <div className="flex gap-3 pt-4">
          <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
          <Link
            href={`/agency/campaigns/${campaignId}`}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
