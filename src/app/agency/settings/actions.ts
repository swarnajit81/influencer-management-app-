"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export async function updateAgencySettingsAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "agency_member" || !user.agencyId) {
    redirect("/login");
  }

  const name = String(formData.get("name") ?? "").trim();
  const gstin = String(formData.get("gstin") ?? "").trim().toUpperCase() || null;
  const pan = String(formData.get("pan") ?? "").trim().toUpperCase() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const logoUrl = String(formData.get("logo_url") ?? "").trim() || null;

  if (!name) {
    redirect("/agency/settings?error=invalid_input");
  }

  // RLS: only owners can update the agencies row. A non-owner update matches
  // zero rows, which we surface as not_allowed.
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("agencies")
    .update({
      name,
      gstin,
      pan,
      address,
      logo_url: logoUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.agencyId)
    .select("id");

  if (error) {
    redirect(`/agency/settings?error=${encodeURIComponent(error.message)}`);
  }
  if (!data || data.length === 0) {
    redirect("/agency/settings?error=not_allowed");
  }

  const admin = createSupabaseAdminClient();
  await admin.from("audit_log").insert({
    actor_profile_id: user.id,
    entity_type: "agency",
    entity_id: user.agencyId,
    action: "agency_settings_updated",
    metadata: { name, gstin, pan },
  });

  redirect("/agency/settings?saved=1");
}
