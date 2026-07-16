import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Auto-provision a brand-side profile the first time the brand takes an
// action on a package. No signup flow: we mint a Supabase auth user with
// email pre-confirmed, insert a matching `profiles` row, and link it to
// the brand via `brand_members`. Returns the profile id (existing or new).
export async function ensureBrandProfile(params: {
  brandId: string;
  contactEmail: string;
  brandName: string | null;
}): Promise<string | null> {
  const email = params.contactEmail.trim().toLowerCase();
  if (!email) return null;

  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from("profiles")
    .select("id, primary_role")
    .eq("email", email)
    .maybeSingle();

  let profileId: string | null = existing?.id ?? null;

  if (!profileId) {
    // Create auth user without a password. email_confirm skips the verification
    // email — the brand didn't ask for an account, they just clicked a button.
    const { data: userRes, error: userErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: params.brandName ?? "Brand",
        role: "brand_member",
        auto_provisioned: true,
      },
    });
    if (userErr || !userRes?.user) {
      // If the auth user already exists (race or leftover), look it up.
      const { data: retry } = await admin
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      profileId = retry?.id ?? null;
      if (!profileId) return null;
    } else {
      profileId = userRes.user.id;
    }

    // profiles row may already have been created by an auth trigger; if not,
    // upsert it here so we always leave a consistent record.
    await admin.from("profiles").upsert(
      {
        id: profileId,
        email,
        full_name: params.brandName ?? "Brand",
        primary_role: "brand_member",
      },
      { onConflict: "id" },
    );
  }

  // Link to brand_members if not already there.
  await admin.from("brand_members").upsert(
    {
      brand_id: params.brandId,
      profile_id: profileId,
      is_owner: true,
    },
    { onConflict: "brand_id,profile_id", ignoreDuplicates: true },
  );

  return profileId;
}
