import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// v1 ships agency-only. brand_member and influencer remain in the DB enum
// (handle_new_user still references them, magic-link flows will use them)
// but the app UI signs up and routes only agency_member users.
export type UserRole = "agency_member" | "brand_member" | "influencer";

export const AGENCY_DASHBOARD_PATH = "/agency";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  agencyId: string | null;
};

// Memoized per-request: layout and page both call requireAgencyMember(), and
// without cache() each caller re-ran the whole auth + DB chain. React cache()
// dedupes within a single server render.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createSupabaseServerClient();

  // getClaims() verifies the ES256 JWT locally (JWKS cached) — no network
  // round-trip to the auth server, unlike getUser().
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;

  // One round-trip: profile + the (0..1) agency membership embedded.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, primary_role, agency_members ( agency_id )")
    .eq("id", claims.sub)
    .single();
  if (!profile) return null;

  const memberships = profile.agency_members as { agency_id: string }[] | null;

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.primary_role as UserRole,
    agencyId: memberships?.[0]?.agency_id ?? null,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAgencyMember(): Promise<CurrentUser & { agencyId: string }> {
  const user = await requireUser();
  if (user.role !== "agency_member" || !user.agencyId) {
    redirect("/login?error=agency_only");
  }
  return user as CurrentUser & { agencyId: string };
}
