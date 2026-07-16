import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { verifyToken } from "@/lib/tokens";

// Polled by both agency (session cookie) and brand (?token=<package>) clients.
// Returns messages for the campaign in ascending order.
export async function GET(
  req: Request,
  ctx: { params: Promise<{ campaignId: string }> },
) {
  const { campaignId } = await ctx.params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  const admin = createSupabaseAdminClient();

  // Auth gate: either a session-authenticated agency member for this campaign,
  // or a valid package token whose campaignId matches.
  let allowed = false;

  if (token) {
    const v = verifyToken(token);
    if (v.ok && v.payload.kind === "package" && v.payload.campaignId === campaignId) {
      allowed = true;
    }
  } else {
    const user = await getCurrentUser();
    if (user?.role === "agency_member" && user.agencyId) {
      const { data: camp } = await admin
        .from("campaigns")
        .select("id")
        .eq("id", campaignId)
        .eq("agency_id", user.agencyId)
        .maybeSingle();
      if (camp) allowed = true;
    }
  }

  if (!allowed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: messages } = await admin
    .from("campaign_messages")
    .select(
      `id, sender_kind, body, created_at,
       profiles:sender_profile_id ( full_name, email )`,
    )
    .eq("campaign_id", campaignId)
    .is("shortlist_item_id", null)
    .order("created_at", { ascending: true })
    .limit(200);

  return NextResponse.json({
    messages: (messages ?? []).map((m: unknown) => {
      const row = m as {
        id: string;
        sender_kind: string;
        body: string;
        created_at: string;
        profiles?: { full_name?: string | null; email?: string | null } | null;
      };
      return {
        id: row.id,
        sender_kind: row.sender_kind,
        body: row.body,
        created_at: row.created_at,
        sender_name: row.profiles?.full_name ?? row.profiles?.email ?? null,
      };
    }),
  });
}
