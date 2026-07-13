/* eslint-disable @typescript-eslint/no-explicit-any */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAgencyMember } from "@/lib/auth/getCurrentUser";
import { createBrandAction } from "@/app/(auth)/actions";
import { SubmitButton } from "@/components/SubmitButton";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "Name and contact email are required.",
};

export default async function AgencyBrands({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const user = await requireAgencyMember();
  const { created, error } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, contact_email, contact_phone, gstin, pan")
    .eq("agency_id", user.agencyId)
    .order("name");

  const errorMessage = error ? (ERROR_MESSAGES[error] ?? decodeURIComponent(error)) : null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Brands</h1>
      </div>

      {created && (
        <p className="mb-4 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          Brand &quot;{decodeURIComponent(created)}&quot; added.
        </p>
      )}
      {errorMessage && (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {errorMessage}
        </p>
      )}

      <section className="mb-10 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold">Add a brand</h2>
        <p className="mt-1 text-xs text-zinc-500">
          You can add GSTIN / PAN later — only the name and a contact email are required to start.
        </p>
        <form action={createBrandAction} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Brand name *" className="sm:col-span-2">
            <input
              type="text"
              name="name"
              required
              maxLength={120}
              className="input"
              placeholder="e.g. AcmeBeauty"
            />
          </Field>
          <Field label="Contact email *">
            <input
              type="email"
              name="contact_email"
              required
              className="input"
              placeholder="brand@example.com"
            />
          </Field>
          <Field label="Contact phone">
            <input
              type="tel"
              name="contact_phone"
              className="input"
              placeholder="+91 9XXXXXXXXX"
            />
          </Field>
          <Field label="GSTIN">
            <input
              type="text"
              name="gstin"
              maxLength={15}
              className="input"
              placeholder="e.g. 27AAAAA0000A1Z5"
            />
          </Field>
          <Field label="PAN">
            <input
              type="text"
              name="pan"
              maxLength={10}
              className="input"
              placeholder="e.g. AAAAA0000A"
            />
          </Field>
          <Field label="Billing address" className="sm:col-span-2">
            <textarea name="billing_address" rows={2} className="input" />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton pendingLabel="Adding…">Add brand</SubmitButton>
          </div>
        </form>
      </section>

      {brands && brands.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Brand</th>
                <th className="px-4 py-3 text-left font-medium">Contact</th>
                <th className="px-4 py-3 text-left font-medium">GSTIN</th>
                <th className="px-4 py-3 text-left font-medium">PAN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {brands.map((b: any) => (
                <tr key={b.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                  <td className="px-4 py-3 font-medium">{b.name}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm">{b.contact_email}</p>
                    {b.contact_phone && (
                      <p className="text-xs text-zinc-500">{b.contact_phone}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {b.gstin || "–"}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {b.pan || "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
          <p className="text-sm text-zinc-500">No brands yet. Add your first brand above.</p>
        </div>
      )}
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
