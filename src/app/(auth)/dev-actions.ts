"use server";

import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function devLoginEnabled(): Promise<boolean> {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_DEV_LOGIN === "1"
  );
}

// Mints a session cookie for an existing agency account without hitting the
// magic-link inbox. Gated on NODE_ENV != "production" or ENABLE_DEV_LOGIN=1.
export async function devLoginAction(formData: FormData): Promise<void> {
  if (!(await devLoginEnabled())) notFound();

  const rawEmail = String(formData.get("email") ?? "").trim().toLowerCase();
  // Default to the seeded demo agency when the caller omits an email — this
  // powers the one-click "Log in as test agency" button. DEMO_AGENCY_EMAIL
  // lets prod point at a different account than local.
  const email =
    rawEmail || process.env.DEMO_AGENCY_EMAIL || "qa-agency@example.com";

  const admin = createSupabaseAdminClient();
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr || !link?.properties?.hashed_token) {
    redirect(
      `/login?error=${encodeURIComponent(linkErr?.message ?? "test_login_no_token")}`,
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: link!.properties.hashed_token,
    type: "magiclink",
  });
  if (error || !data.session) {
    redirect(
      `/login?error=${encodeURIComponent(error?.message ?? "test_login_verify_failed")}`,
    );
  }

  redirect("/agency");
}
