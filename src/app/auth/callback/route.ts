import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AGENCY_DASHBOARD_PATH } from "@/lib/auth/getCurrentUser";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const explicitNext = url.searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  if (explicitNext) {
    return NextResponse.redirect(new URL(explicitNext, url.origin));
  }

  // v1: app only signs up agency_member. Non-agency accounts (if any exist
  // from prior signups) get bounced to login with an explicit message — they
  // belong on the magic-link surface, not the app.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?error=session_lost", url.origin));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("primary_role")
    .eq("id", user.id)
    .single();

  if (profile?.primary_role !== "agency_member") {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=agency_only", url.origin));
  }

  return NextResponse.redirect(new URL(AGENCY_DASHBOARD_PATH, url.origin));
}
