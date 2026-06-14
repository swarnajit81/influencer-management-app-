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

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, primary_role")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  const { data: agency } = await supabase
    .from("agency_members")
    .select("agency_id")
    .eq("profile_id", user.id)
    .maybeSingle();

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.primary_role as UserRole,
    agencyId: agency?.agency_id ?? null,
  };
}

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
