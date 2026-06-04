import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { dashboardPathFor, type UserRole } from "@/lib/auth/getCurrentUser";

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

  const role = (profile?.primary_role as UserRole | undefined) ?? "influencer";
  return NextResponse.redirect(new URL(dashboardPathFor(role), url.origin));
}
