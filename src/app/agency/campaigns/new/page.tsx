import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAgencyMember } from "@/lib/auth/getCurrentUser";
import { createCampaignAction } from "@/app/(auth)/actions";
import { SubmitButton } from "@/components/SubmitButton";

export default async function NewCampaignPage() {
  const user = await requireAgencyMember();

  const supabase = await createSupabaseServerClient();
  const { data: brands } = await supabase
    .from("brands")
    .select("id, name")
    .eq("agency_id", user.agencyId)
    .order("name");

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/agency/campaigns"
        className="mb-6 inline-block text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Back to campaigns
      </Link>

      <h1 className="text-2xl font-semibold">Create campaign</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Set the brief, budget, and target dates. Invite influencers on the next step.
      </p>

      <form action={createCampaignAction} className="mt-8 space-y-6">
        <Field label="Campaign name" required>
          <input name="name" type="text" className="input" />
        </Field>

        <Field label="Brand" required>
          <select name="brand_id" className="input" required>
            <option value="">— Select a brand —</option>
            {brands?.map((b: any) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          {!brands || brands.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">
              No brands found. Create one in the Brands tab first.
            </p>
          ) : null}
        </Field>

        <Field label="Brief">
          <textarea name="brief" rows={4} className="input" />
        </Field>

        <Field label="Total budget (₹)" required>
          <input
            name="budget_rupees"
            type="number"
            step="100"
            min="0"
            className="input"
            required
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Start date">
            <input name="start_date" type="date" className="input" />
          </Field>
          <Field label="End date">
            <input name="end_date" type="date" className="input" />
          </Field>
        </div>

        <div className="flex gap-3 pt-4">
          <SubmitButton pendingLabel="Creating…">Create campaign</SubmitButton>
          <Link
            href="/agency/campaigns"
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
