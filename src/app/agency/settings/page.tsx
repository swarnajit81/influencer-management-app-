import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAgencyMember } from "@/lib/auth/getCurrentUser";
import { updateAgencySettingsAction } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "Agency name is required.",
  not_allowed: "Only the agency owner can edit these settings.",
};

export default async function AgencySettings({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const user = await requireAgencyMember();
  const { saved, error } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const { data: agency } = await supabase
    .from("agencies")
    .select("id, name, gstin, pan, address, logo_url")
    .eq("id", user.agencyId)
    .single();

  const errorMessage = error ? (ERROR_MESSAGES[error] ?? decodeURIComponent(error)) : null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Agency settings</h1>
      </div>

      {saved && (
        <p className="mb-4 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          Settings saved.
        </p>
      )}
      {errorMessage && (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {errorMessage}
        </p>
      )}

      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold">Business details</h2>
        <p className="mt-1 text-xs text-zinc-500">
          These appear on contracts and invoices sent to brands and influencers.
        </p>
        <form action={updateAgencySettingsAction} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Agency name *" className="sm:col-span-2">
            <input
              type="text"
              name="name"
              required
              maxLength={120}
              defaultValue={agency?.name ?? ""}
              className="input"
            />
          </Field>
          <Field label="GSTIN">
            <input
              type="text"
              name="gstin"
              maxLength={15}
              defaultValue={agency?.gstin ?? ""}
              className="input"
              placeholder="e.g. 27AAAAA0000A1Z5"
            />
          </Field>
          <Field label="PAN">
            <input
              type="text"
              name="pan"
              maxLength={10}
              defaultValue={agency?.pan ?? ""}
              className="input"
              placeholder="e.g. AAAAA0000A"
            />
          </Field>
          <Field label="Logo URL" className="sm:col-span-2">
            <input
              type="url"
              name="logo_url"
              defaultValue={agency?.logo_url ?? ""}
              className="input"
              placeholder="https://…/logo.png"
            />
          </Field>
          <Field label="Registered address" className="sm:col-span-2">
            <textarea
              name="address"
              rows={3}
              defaultValue={agency?.address ?? ""}
              className="input"
            />
          </Field>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Save settings
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
