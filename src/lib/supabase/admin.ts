// Service-role client. Bypasses RLS — only use server-side for trusted
// flows (e.g. creating contracts from an accepted invitation, webhook
// handlers updating contract / payout rows).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;

export function createSupabaseAdminClient(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return _admin;
}
