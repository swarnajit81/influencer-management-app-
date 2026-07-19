import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const EPOCH = "1970-01-01T00:00:00Z";

export async function getInboxLastSeenAt(
  agencyId: string,
  profileId: string,
): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("agency_members")
    .select("last_inbox_seen_at")
    .eq("agency_id", agencyId)
    .eq("profile_id", profileId)
    .maybeSingle();
  return (data?.last_inbox_seen_at as string | undefined) ?? EPOCH;
}

export async function getInboxUnreadCount(
  agencyId: string,
  profileId: string,
): Promise<number> {
  const admin = createSupabaseAdminClient();
  const since = await getInboxLastSeenAt(agencyId, profileId);

  const [{ count: eventCount }, { count: msgCount }] = await Promise.all([
    admin
      .from("package_events")
      .select("id, campaigns!inner(agency_id)", { head: true, count: "exact" })
      .eq("campaigns.agency_id", agencyId)
      .eq("actor_kind", "brand")
      .gt("occurred_at", since),
    admin
      .from("campaign_messages")
      .select("id, campaigns!inner(agency_id)", { head: true, count: "exact" })
      .eq("campaigns.agency_id", agencyId)
      .eq("sender_kind", "brand")
      .gt("created_at", since),
  ]);

  return (eventCount ?? 0) + (msgCount ?? 0);
}

export async function markInboxSeen(
  agencyId: string,
  profileId: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin
    .from("agency_members")
    .update({ last_inbox_seen_at: new Date().toISOString() })
    .eq("agency_id", agencyId)
    .eq("profile_id", profileId);
}
