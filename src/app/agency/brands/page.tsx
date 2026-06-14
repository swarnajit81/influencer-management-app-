import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAgencyMember } from "@/lib/auth/getCurrentUser";

export default async function AgencyBrands() {
  const user = await requireAgencyMember();

  const supabase = await createSupabaseServerClient();
  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, contact_email, contact_phone, gstin")
    .eq("agency_id", user.agencyId)
    .order("name");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Brands</h1>
        <button
          disabled
          className="rounded-md bg-zinc-300 px-4 py-2 text-sm font-medium text-zinc-500 cursor-not-allowed dark:bg-zinc-700"
        >
          New brand (coming soon)
        </button>
      </div>

      {brands && brands.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Brand</th>
                <th className="px-4 py-3 text-left font-medium">Contact</th>
                <th className="px-4 py-3 text-left font-medium">GSTIN</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-6 py-12 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="text-sm text-zinc-500">
            No brands yet. Contact support to add brands to your account.
          </p>
        </div>
      )}
    </div>
  );
}
