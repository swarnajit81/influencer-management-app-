import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type UserRole = "agency_member" | "brand_member" | "influencer";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  agencyId: string | null;
  brandId: string | null;
  influencerId: string | null;
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

  const [agencyRes, brandRes, influencerRes] = await Promise.all([
    supabase.from("agency_members").select("agency_id").eq("profile_id", user.id).maybeSingle(),
    supabase.from("brand_members").select("brand_id").eq("profile_id", user.id).maybeSingle(),
    supabase.from("influencers").select("id").eq("profile_id", user.id).maybeSingle(),
  ]);

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.primary_role as UserRole,
    agencyId: agencyRes.data?.agency_id ?? null,
    brandId: brandRes.data?.brand_id ?? null,
    influencerId: influencerRes.data?.id ?? null,
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function dashboardPathFor(role: UserRole): string {
  switch (role) {
    case "agency_member":
      return "/agency";
    case "brand_member":
      return "/brand";
    case "influencer":
      return "/influencer";
  }
}

export async function requireRole(expected: UserRole): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== expected) redirect(dashboardPathFor(user.role));
  return user;
}
