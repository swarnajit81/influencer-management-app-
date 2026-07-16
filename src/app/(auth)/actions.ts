"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/auth/getCurrentUser";
import { sendEmail } from "@/lib/email/resend";
import { signToken } from "@/lib/tokens";
import { formatPaiseAsINR } from "@/lib/money";

function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return new URL(path, base).toString();
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const agencyName = String(formData.get("agency_name") ?? "").trim();

  if (!email || !fullName || !agencyName) {
    redirect("/signup?error=invalid_input");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: appUrl("/auth/callback"),
      data: {
        full_name: fullName,
        role: "agency_member" satisfies UserRole,
        agency_name: agencyName,
      },
    },
  });

  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  redirect(`/check-email?email=${encodeURIComponent(email)}`);
}

export async function logInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) redirect("/login?error=invalid_input");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: appUrl("/auth/callback"),
    },
  });

  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect(`/check-email?email=${encodeURIComponent(email)}`);
}

export async function logOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function createBrandAction(formData: FormData) {
  const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
  const user = await getCurrentUser();
  if (!user || user.role !== "agency_member" || !user.agencyId) {
    redirect("/login");
  }

  const name = String(formData.get("name") ?? "").trim();
  const contactEmail = String(formData.get("contact_email") ?? "").trim().toLowerCase();
  const contactPhone = String(formData.get("contact_phone") ?? "").trim() || null;
  const gstin = String(formData.get("gstin") ?? "").trim().toUpperCase() || null;
  const pan = String(formData.get("pan") ?? "").trim().toUpperCase() || null;
  const billingAddress = String(formData.get("billing_address") ?? "").trim() || null;

  if (!name || !contactEmail) {
    redirect("/agency/brands?error=invalid_input");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("brands").insert({
    agency_id: user.agencyId,
    name,
    contact_email: contactEmail,
    contact_phone: contactPhone,
    gstin,
    pan,
    billing_address: billingAddress,
  });

  if (error) {
    redirect(`/agency/brands?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/agency/brands?created=${encodeURIComponent(name)}`);
}

export async function createCampaignAction(formData: FormData) {
  const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
  const user = await getCurrentUser();
  if (!user || user.role !== "agency_member" || !user.agencyId) {
    redirect("/login");
  }

  const name = String(formData.get("name") ?? "").trim();
  const brandId = String(formData.get("brand_id") ?? "").trim();
  const brief = String(formData.get("brief") ?? "").trim() || null;
  const budgetRupees = Number(formData.get("budget_rupees") ?? 0);
  const startDate = String(formData.get("start_date") ?? "").trim() || null;
  const endDate = String(formData.get("end_date") ?? "").trim() || null;

  if (!name || !brandId || budgetRupees <= 0) {
    redirect("/agency/campaigns?error=invalid_input");
  }

  const supabase = await createSupabaseServerClient();

  // Verify the brand belongs to this agency
  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .eq("agency_id", user.agencyId)
    .single();

  if (!brand) {
    redirect("/agency/campaigns?error=brand_not_found");
  }

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      agency_id: user.agencyId,
      brand_id: brandId,
      name,
      brief,
      total_budget_inr_paise: Math.round(budgetRupees * 100),
      start_date: startDate,
      end_date: endDate,
      status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    redirect(`/agency/campaigns?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/agency/campaigns/${campaign.id}`);
}

const CAMPAIGN_STATUSES = [
  "draft",
  "pitching",
  "brand_approved",
  "active",
  "completed",
  "cancelled",
] as const;

export async function updateCampaignAction(formData: FormData) {
  const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
  const user = await getCurrentUser();
  if (!user || user.role !== "agency_member" || !user.agencyId) {
    redirect("/login");
  }

  const campaignId = String(formData.get("campaign_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const brief = String(formData.get("brief") ?? "").trim() || null;
  const budgetRupees = Number(formData.get("budget_rupees") ?? 0);
  const startDate = String(formData.get("start_date") ?? "").trim() || null;
  const endDate = String(formData.get("end_date") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "").trim();

  if (!campaignId) redirect("/agency/campaigns?error=invalid_input");
  if (!name || budgetRupees <= 0) {
    redirect(`/agency/campaigns/${campaignId}/edit?error=invalid_input`);
  }
  if (!(CAMPAIGN_STATUSES as readonly string[]).includes(status)) {
    redirect(`/agency/campaigns/${campaignId}/edit?error=invalid_status`);
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("agency_id", user.agencyId)
    .single();

  if (!existing) redirect("/agency/campaigns?error=campaign_not_found");

  const { error } = await supabase
    .from("campaigns")
    .update({
      name,
      brief,
      total_budget_inr_paise: Math.round(budgetRupees * 100),
      start_date: startDate,
      end_date: endDate,
      status,
    })
    .eq("id", campaignId)
    .eq("agency_id", user.agencyId);

  if (error) {
    redirect(
      `/agency/campaigns/${campaignId}/edit?error=${encodeURIComponent(error.message)}`,
    );
  }

  const admin = createSupabaseAdminClient();
  await admin.from("audit_log").insert({
    actor_profile_id: user.id,
    entity_type: "campaign",
    entity_id: campaignId,
    action: "campaign_updated",
    metadata: { fields: ["name", "brief", "total_budget_inr_paise", "start_date", "end_date", "status"] },
  });

  redirect(`/agency/campaigns/${campaignId}?updated=1`);
}

// Allowed campaign status transitions. Enforced server-side so the UI
// buttons can't drive the campaign into a state that skips a stage.
const CAMPAIGN_TRANSITIONS: Record<string, readonly string[]> = {
  draft: ["pitching", "cancelled"],
  pitching: ["draft", "brand_approved", "cancelled"],
  brand_approved: ["active", "pitching", "cancelled"],
  active: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export async function setCampaignStatusAction(formData: FormData) {
  const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
  const user = await getCurrentUser();
  if (!user || user.role !== "agency_member" || !user.agencyId) {
    redirect("/login");
  }

  const campaignId = String(formData.get("campaign_id") ?? "").trim();
  const target = String(formData.get("target_status") ?? "").trim();
  if (!campaignId || !target) {
    redirect(`/agency/campaigns/${campaignId}?error=invalid_input`);
  }
  if (!(CAMPAIGN_STATUSES as readonly string[]).includes(target)) {
    redirect(`/agency/campaigns/${campaignId}?error=invalid_status`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, status")
    .eq("id", campaignId)
    .eq("agency_id", user.agencyId)
    .single();

  if (!campaign) redirect("/agency/campaigns?error=campaign_not_found");

  const allowed = CAMPAIGN_TRANSITIONS[campaign.status] ?? [];
  if (!allowed.includes(target)) {
    redirect(
      `/agency/campaigns/${campaignId}?error=illegal_transition_${campaign.status}_to_${target}`,
    );
  }

  const { error } = await supabase
    .from("campaigns")
    .update({ status: target })
    .eq("id", campaignId)
    .eq("agency_id", user.agencyId);

  if (error) {
    redirect(
      `/agency/campaigns/${campaignId}?error=${encodeURIComponent(error.message)}`,
    );
  }

  const admin = createSupabaseAdminClient();
  await admin.from("audit_log").insert({
    actor_profile_id: user.id,
    entity_type: "campaign",
    entity_id: campaignId,
    action: `campaign_status_${target}`,
    metadata: { from: campaign.status, to: target },
  });

  revalidatePath(`/agency/campaigns/${campaignId}`);
  revalidatePath("/agency/campaigns");
  redirect(`/agency/campaigns/${campaignId}?status_set=${target}`);
}


// -----------------------------------------------------------------
// Roster management (Sprint 1): agency-owned influencer records
// -----------------------------------------------------------------

const PLATFORMS = ["instagram", "youtube", "twitter", "other"] as const;

function toIntOrNull(v: FormDataEntryValue | null): number | null {
  const n = Number(v ?? 0);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

function toDecimalOrNull(v: FormDataEntryValue | null): number | null {
  const n = Number(v ?? 0);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseCategories(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0)
    .slice(0, 20);
}

function parsePortfolioUrls(raw: string): string[] {
  return raw
    .split(/\s+|,/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s))
    .slice(0, 20);
}

export async function createInfluencerAction(formData: FormData) {
  const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
  const user = await getCurrentUser();
  if (!user || user.role !== "agency_member" || !user.agencyId) {
    redirect("/login");
  }

  const displayName = String(formData.get("display_name") ?? "").trim();
  const instagramHandle = normalizeHandle(formData.get("instagram_handle"));
  const youtubeHandle = normalizeHandle(formData.get("youtube_handle"));
  const twitterHandle = normalizeHandle(formData.get("twitter_handle"));
  const primaryPlatform = String(formData.get("primary_platform") ?? "").trim();
  const followerCount = toIntOrNull(formData.get("follower_count_total"));
  const engagementRate = toDecimalOrNull(formData.get("engagement_rate"));
  const city = String(formData.get("city") ?? "").trim() || null;
  const state = String(formData.get("state") ?? "").trim() || null;
  const contactEmail = String(formData.get("contact_email") ?? "").trim().toLowerCase() || null;
  const contactPhone = String(formData.get("contact_phone") ?? "").trim() || null;
  const bio = String(formData.get("bio") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const categories = parseCategories(String(formData.get("categories") ?? ""));
  const portfolioUrls = parsePortfolioUrls(String(formData.get("portfolio_urls") ?? ""));

  if (!displayName) {
    redirect("/agency/influencers/new?error=display_name_required");
  }
  if (
    primaryPlatform &&
    !(PLATFORMS as readonly string[]).includes(primaryPlatform)
  ) {
    redirect("/agency/influencers/new?error=invalid_platform");
  }

  const admin = createSupabaseAdminClient();

  // Dedupe on (agency roster, instagram_handle). If an existing influencer on
  // this agency's roster already uses the handle, redirect instead of dup.
  if (instagramHandle) {
    const { data: dupe } = await admin
      .from("agency_influencer_roster")
      .select("influencer_id, influencers!inner (instagram_handle)")
      .eq("agency_id", user.agencyId)
      .eq("influencers.instagram_handle", instagramHandle)
      .maybeSingle();
    if (dupe?.influencer_id) {
      redirect(
        `/agency/influencers/${dupe.influencer_id}?error=duplicate_handle`,
      );
    }
  }

  const { data: inf, error: infErr } = await admin
    .from("influencers")
    .insert({
      display_name: displayName,
      instagram_handle: instagramHandle,
      youtube_handle: youtubeHandle,
      twitter_handle: twitterHandle,
      primary_platform: primaryPlatform || null,
      follower_count_total: followerCount ?? 0,
      engagement_rate: engagementRate,
      city,
      state,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      bio,
      notes,
      niches: categories,
      portfolio_urls: portfolioUrls,
    })
    .select("id")
    .single();

  if (infErr || !inf) {
    redirect(
      `/agency/influencers/new?error=${encodeURIComponent(
        infErr?.message ?? "create_failed",
      )}`,
    );
  }

  const { error: rosterErr } = await admin.from("agency_influencer_roster").insert({
    agency_id: user.agencyId,
    influencer_id: inf.id,
    added_by: user.id,
  });
  if (rosterErr) {
    redirect(
      `/agency/influencers?error=${encodeURIComponent(rosterErr.message)}`,
    );
  }

  await admin.from("audit_log").insert({
    actor_profile_id: user.id,
    entity_type: "influencer",
    entity_id: inf.id,
    action: "influencer_created",
    metadata: { source: "manual" },
  });

  revalidatePath("/agency/influencers");
  redirect(`/agency/influencers/${inf.id}?saved=1`);
}

function normalizeHandle(raw: FormDataEntryValue | null): string | null {
  const s = String(raw ?? "").trim().replace(/^@+/, "");
  return s.length > 0 ? s.toLowerCase() : null;
}

export async function updateInfluencerProfileAction(formData: FormData) {
  const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
  const user = await getCurrentUser();
  if (!user || user.role !== "agency_member" || !user.agencyId) {
    redirect("/login");
  }

  const influencerId = String(formData.get("influencer_id") ?? "").trim();
  if (!influencerId) redirect("/agency/influencers?error=invalid_input");

  const supabase = await createSupabaseServerClient();
  const { data: roster } = await supabase
    .from("agency_influencer_roster")
    .select("agency_id")
    .eq("agency_id", user.agencyId)
    .eq("influencer_id", influencerId)
    .single();
  if (!roster) redirect("/agency/influencers?error=not_on_roster");

  const admin = createSupabaseAdminClient();
  const updates: Record<string, unknown> = {
    display_name: String(formData.get("display_name") ?? "").trim(),
    instagram_handle: normalizeHandle(formData.get("instagram_handle")),
    youtube_handle: normalizeHandle(formData.get("youtube_handle")),
    twitter_handle: normalizeHandle(formData.get("twitter_handle")),
    primary_platform:
      String(formData.get("primary_platform") ?? "").trim() || null,
    follower_count_total: toIntOrNull(formData.get("follower_count_total")) ?? 0,
    engagement_rate: toDecimalOrNull(formData.get("engagement_rate")),
    city: String(formData.get("city") ?? "").trim() || null,
    state: String(formData.get("state") ?? "").trim() || null,
    contact_email:
      String(formData.get("contact_email") ?? "").trim().toLowerCase() || null,
    contact_phone: String(formData.get("contact_phone") ?? "").trim() || null,
    bio: String(formData.get("bio") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    niches: parseCategories(String(formData.get("categories") ?? "")),
    portfolio_urls: parsePortfolioUrls(
      String(formData.get("portfolio_urls") ?? ""),
    ),
    updated_at: new Date().toISOString(),
  };

  if (!updates.display_name) {
    redirect(`/agency/influencers/${influencerId}?error=display_name_required`);
  }

  const { error } = await admin
    .from("influencers")
    .update(updates)
    .eq("id", influencerId);

  if (error) {
    redirect(
      `/agency/influencers/${influencerId}?error=${encodeURIComponent(error.message)}`,
    );
  }

  await admin.from("audit_log").insert({
    actor_profile_id: user.id,
    entity_type: "influencer",
    entity_id: influencerId,
    action: "influencer_profile_updated",
    metadata: { fields: Object.keys(updates) },
  });

  revalidatePath(`/agency/influencers/${influencerId}`);
  revalidatePath("/agency/influencers");
  redirect(`/agency/influencers/${influencerId}?saved=1`);
}

export async function removeInfluencerFromRosterAction(formData: FormData) {
  const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
  const user = await getCurrentUser();
  if (!user || user.role !== "agency_member" || !user.agencyId) {
    redirect("/login");
  }

  const influencerId = String(formData.get("influencer_id") ?? "").trim();
  if (!influencerId) redirect("/agency/influencers?error=invalid_input");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("agency_influencer_roster")
    .delete()
    .eq("agency_id", user.agencyId)
    .eq("influencer_id", influencerId);

  if (error) {
    redirect(`/agency/influencers?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/agency/influencers");
  redirect("/agency/influencers?removed=1");
}

const RATE_CARD_TYPES = [
  "instagram_post",
  "instagram_reel",
  "instagram_story",
  "youtube_video",
  "youtube_short",
  "twitter_post",
  "blog_post",
  "other",
] as const;

export async function saveRateCardAction(formData: FormData) {
  const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
  const user = await getCurrentUser();
  if (!user || user.role !== "agency_member" || !user.agencyId) {
    redirect("/login");
  }

  const influencerId = String(formData.get("influencer_id") ?? "").trim();
  if (!influencerId) redirect("/agency/influencers?error=invalid_input");

  const supabase = await createSupabaseServerClient();
  const { data: roster } = await supabase
    .from("agency_influencer_roster")
    .select("agency_id")
    .eq("agency_id", user.agencyId)
    .eq("influencer_id", influencerId)
    .single();
  if (!roster) redirect("/agency/influencers?error=not_on_roster");

  const admin = createSupabaseAdminClient();
  const rows: Array<{
    influencer_id: string;
    deliverable_type: string;
    cost_inr_paise: number;
  }> = [];
  const deletes: string[] = [];

  for (const t of RATE_CARD_TYPES) {
    const raw = formData.get(`rate_${t}`);
    if (raw === null || String(raw).trim() === "") {
      deletes.push(t);
      continue;
    }
    const rupees = Number(raw);
    if (!Number.isFinite(rupees) || rupees < 0) continue;
    rows.push({
      influencer_id: influencerId,
      deliverable_type: t,
      cost_inr_paise: Math.round(rupees * 100),
    });
  }

  if (rows.length > 0) {
    const { error } = await admin
      .from("influencer_rate_card")
      .upsert(rows, { onConflict: "influencer_id,deliverable_type" });
    if (error) {
      redirect(
        `/agency/influencers/${influencerId}?error=${encodeURIComponent(error.message)}`,
      );
    }
  }

  if (deletes.length > 0) {
    await admin
      .from("influencer_rate_card")
      .delete()
      .eq("influencer_id", influencerId)
      .in("deliverable_type", deletes);
  }

  await admin.from("audit_log").insert({
    actor_profile_id: user.id,
    entity_type: "influencer",
    entity_id: influencerId,
    action: "rate_card_updated",
    metadata: { upsert: rows.length, delete: deletes.length },
  });

  revalidatePath(`/agency/influencers/${influencerId}`);
  redirect(`/agency/influencers/${influencerId}?saved=1#rate-card`);
}

type ImportRow = {
  display_name: string;
  instagram_handle: string | null;
  youtube_handle: string | null;
  twitter_handle: string | null;
  follower_count_total: number;
  engagement_rate: number | null;
  city: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  categories: string[];
};

export async function importInfluencersAction(formData: FormData) {
  const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
  const user = await getCurrentUser();
  if (!user || user.role !== "agency_member" || !user.agencyId) {
    redirect("/login");
  }

  const rowsJson = String(formData.get("rows_json") ?? "").trim();
  if (!rowsJson) redirect("/agency/influencers/import?error=empty_rows");

  let parsed: unknown;
  try {
    parsed = JSON.parse(rowsJson);
  } catch {
    redirect("/agency/influencers/import?error=invalid_json");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    redirect("/agency/influencers/import?error=empty_rows");
  }

  const rows = (parsed as ImportRow[]).slice(0, 1000);
  const admin = createSupabaseAdminClient();

  // Existing handles on this agency's roster (for dedupe).
  const { data: existing } = await admin
    .from("agency_influencer_roster")
    .select("influencer_id, influencers!inner (instagram_handle)")
    .eq("agency_id", user.agencyId);
  const existingHandles = new Set(
    (existing ?? [])
      .map((r: { influencers?: { instagram_handle?: string | null } | { instagram_handle?: string | null }[] }) => {
        const inf = Array.isArray(r.influencers) ? r.influencers[0] : r.influencers;
        return inf?.instagram_handle ?? null;
      })
      .filter((h): h is string => !!h),
  );

  let inserted = 0;
  let skipped = 0;

  for (const r of rows) {
    const displayName = String(r.display_name ?? "").trim();
    if (!displayName) {
      skipped++;
      continue;
    }
    const handle = r.instagram_handle
      ? String(r.instagram_handle).trim().replace(/^@+/, "").toLowerCase()
      : null;
    if (handle && existingHandles.has(handle)) {
      skipped++;
      continue;
    }

    const { data: inf, error: infErr } = await admin
      .from("influencers")
      .insert({
        display_name: displayName,
        instagram_handle: handle,
        youtube_handle: r.youtube_handle
          ? String(r.youtube_handle).trim().replace(/^@+/, "").toLowerCase()
          : null,
        twitter_handle: r.twitter_handle
          ? String(r.twitter_handle).trim().replace(/^@+/, "").toLowerCase()
          : null,
        follower_count_total: Number.isFinite(r.follower_count_total)
          ? Math.max(0, Math.floor(r.follower_count_total))
          : 0,
        engagement_rate: Number.isFinite(r.engagement_rate)
          ? r.engagement_rate
          : null,
        city: r.city ? String(r.city).trim() || null : null,
        contact_email: r.contact_email
          ? String(r.contact_email).trim().toLowerCase() || null
          : null,
        contact_phone: r.contact_phone
          ? String(r.contact_phone).trim() || null
          : null,
        niches: Array.isArray(r.categories)
          ? r.categories.map((c) => String(c).trim().toLowerCase()).slice(0, 20)
          : [],
      })
      .select("id")
      .single();

    if (infErr || !inf) {
      skipped++;
      continue;
    }

    const { error: rosterErr } = await admin
      .from("agency_influencer_roster")
      .insert({
        agency_id: user.agencyId,
        influencer_id: inf.id,
        added_by: user.id,
      });
    if (rosterErr) {
      skipped++;
      continue;
    }

    if (handle) existingHandles.add(handle);
    inserted++;
  }

  await admin.from("audit_log").insert({
    actor_profile_id: user.id,
    entity_type: "agency_influencer_roster",
    entity_id: user.agencyId,
    action: "influencer_import",
    metadata: { inserted, skipped, submitted: rows.length },
  });

  revalidatePath("/agency/influencers");
  redirect(
    `/agency/influencers?imported=${inserted}&skipped=${skipped}`,
  );
}

// -----------------------------------------------------------------
// Sprint 2: campaign shortlist (agency pitching influencers to brand)
// -----------------------------------------------------------------

const DELIVERABLE_TYPE_KEYS = [
  "instagram_post",
  "instagram_reel",
  "instagram_story",
  "youtube_video",
  "youtube_short",
  "twitter_post",
  "blog_post",
  "other",
] as const;

async function assertCampaignAgency(
  campaignId: string,
  agencyId: string,
): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("agency_id", agencyId)
    .maybeSingle();
  return !!data;
}

export async function addShortlistItemAction(formData: FormData) {
  const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
  const user = await getCurrentUser();
  if (!user || user.role !== "agency_member" || !user.agencyId) {
    redirect("/login");
  }

  const campaignId = String(formData.get("campaign_id") ?? "").trim();
  const influencerId = String(formData.get("influencer_id") ?? "").trim();
  if (!campaignId || !influencerId) {
    redirect(`/agency/campaigns/${campaignId}?error=invalid_input`);
  }
  if (!(await assertCampaignAgency(campaignId, user.agencyId))) {
    redirect("/agency/campaigns?error=campaign_not_found");
  }

  const admin = createSupabaseAdminClient();

  // Verify roster membership.
  const { data: roster } = await admin
    .from("agency_influencer_roster")
    .select("agency_id")
    .eq("agency_id", user.agencyId)
    .eq("influencer_id", influencerId)
    .maybeSingle();
  if (!roster) {
    redirect(
      `/agency/campaigns/${campaignId}?error=influencer_not_on_roster`,
    );
  }

  // Autofill proposed_cost from the influencer's default rate card entry
  // (instagram_post is a reasonable default; agency can override).
  const { data: rateRow } = await admin
    .from("influencer_rate_card")
    .select("cost_inr_paise")
    .eq("influencer_id", influencerId)
    .eq("deliverable_type", "instagram_post")
    .maybeSingle();

  const cost = Number(rateRow?.cost_inr_paise ?? 0);
  const suggestedBrandPrice = Math.round(cost * 1.3); // 30% margin default

  const { error } = await admin.from("campaign_shortlist_items").insert({
    campaign_id: campaignId,
    influencer_id: influencerId,
    proposed_cost_inr_paise: cost,
    brand_price_inr_paise: suggestedBrandPrice,
    deliverables: [{ type: "instagram_post", count: 1 }],
  });

  if (error) {
    // 23505 = unique_violation → already on shortlist.
    if ((error as { code?: string }).code === "23505") {
      redirect(`/agency/campaigns/${campaignId}?error=already_shortlisted`);
    }
    redirect(
      `/agency/campaigns/${campaignId}?error=${encodeURIComponent(error.message)}`,
    );
  }

  await admin.from("audit_log").insert({
    actor_profile_id: user.id,
    entity_type: "campaign",
    entity_id: campaignId,
    action: "shortlist_item_added",
    metadata: { influencer_id: influencerId },
  });

  revalidatePath(`/agency/campaigns/${campaignId}`);
  redirect(`/agency/campaigns/${campaignId}?shortlisted=1`);
}

export async function addShortlistItemsBulkAction(formData: FormData) {
  const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
  const user = await getCurrentUser();
  if (!user || user.role !== "agency_member" || !user.agencyId) {
    redirect("/login");
  }

  const campaignId = String(formData.get("campaign_id") ?? "").trim();
  const ids = formData
    .getAll("influencer_id")
    .map((v) => String(v).trim())
    .filter(Boolean);

  if (!campaignId) redirect("/agency/campaigns?error=invalid_input");
  if (ids.length === 0) {
    redirect(`/agency/campaigns/${campaignId}?error=no_creators_selected`);
  }
  if (!(await assertCampaignAgency(campaignId, user.agencyId))) {
    redirect("/agency/campaigns?error=campaign_not_found");
  }

  const admin = createSupabaseAdminClient();

  // Restrict to roster members.
  const { data: roster } = await admin
    .from("agency_influencer_roster")
    .select("influencer_id")
    .eq("agency_id", user.agencyId)
    .in("influencer_id", ids);
  const rosterIds = new Set((roster ?? []).map((r) => r.influencer_id));
  const validIds = ids.filter((id) => rosterIds.has(id));
  if (validIds.length === 0) {
    redirect(
      `/agency/campaigns/${campaignId}?error=influencer_not_on_roster`,
    );
  }

  // Rate card autofill: fetch instagram_post cost for each in one query.
  const { data: rates } = await admin
    .from("influencer_rate_card")
    .select("influencer_id, cost_inr_paise")
    .eq("deliverable_type", "instagram_post")
    .in("influencer_id", validIds);
  const rateByInfluencer = new Map<string, number>(
    (rates ?? []).map((r) => [r.influencer_id, Number(r.cost_inr_paise ?? 0)]),
  );

  const rows = validIds.map((id) => {
    const cost = rateByInfluencer.get(id) ?? 0;
    return {
      campaign_id: campaignId,
      influencer_id: id,
      proposed_cost_inr_paise: cost,
      brand_price_inr_paise: Math.round(cost * 1.3),
      deliverables: [{ type: "instagram_post", count: 1 }],
    };
  });

  // Upsert with onConflict ignore-style: insert-only, existing rows skip.
  // Supabase JS lacks direct ON CONFLICT DO NOTHING for insert(), so use
  // upsert() with the unique key and ignoreDuplicates.
  const { error } = await admin
    .from("campaign_shortlist_items")
    .upsert(rows, {
      onConflict: "campaign_id,influencer_id",
      ignoreDuplicates: true,
    });

  if (error) {
    redirect(
      `/agency/campaigns/${campaignId}?error=${encodeURIComponent(error.message)}`,
    );
  }

  await admin.from("audit_log").insert({
    actor_profile_id: user.id,
    entity_type: "campaign",
    entity_id: campaignId,
    action: "shortlist_bulk_added",
    metadata: { influencer_ids: validIds, count: validIds.length },
  });

  revalidatePath(`/agency/campaigns/${campaignId}`);
  redirect(
    `/agency/campaigns/${campaignId}?shortlisted_bulk=${validIds.length}`,
  );
}

export async function updateShortlistItemAction(formData: FormData) {
  const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
  const user = await getCurrentUser();
  if (!user || user.role !== "agency_member" || !user.agencyId) {
    redirect("/login");
  }

  const itemId = String(formData.get("item_id") ?? "").trim();
  const campaignId = String(formData.get("campaign_id") ?? "").trim();
  const rationale = String(formData.get("rationale") ?? "").trim() || null;
  const costRupees = Number(formData.get("proposed_cost_rupees") ?? 0);
  const brandPriceRupees = Number(formData.get("brand_price_rupees") ?? 0);
  const sampleUrlsRaw = String(formData.get("sample_urls") ?? "");

  if (!itemId || !campaignId) {
    redirect(`/agency/campaigns/${campaignId}?error=invalid_input`);
  }
  if (!(await assertCampaignAgency(campaignId, user.agencyId))) {
    redirect("/agency/campaigns?error=campaign_not_found");
  }

  // Deliverables: parse rows[<type>]=<count>.
  const deliverables: Array<{ type: string; count: number }> = [];
  for (const t of DELIVERABLE_TYPE_KEYS) {
    const raw = formData.get(`deliv_${t}`);
    if (raw === null || String(raw).trim() === "") continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) continue;
    deliverables.push({ type: t, count: Math.floor(n) });
  }

  const sampleUrls = sampleUrlsRaw
    .split(/\s+|,/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s))
    .slice(0, 20);

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("campaign_shortlist_items")
    .update({
      rationale,
      proposed_cost_inr_paise: Math.max(0, Math.round(costRupees * 100)),
      brand_price_inr_paise: Math.max(0, Math.round(brandPriceRupees * 100)),
      deliverables,
      sample_urls: sampleUrls,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("campaign_id", campaignId);

  if (error) {
    redirect(
      `/agency/campaigns/${campaignId}?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath(`/agency/campaigns/${campaignId}`);
  redirect(`/agency/campaigns/${campaignId}?item_saved=1`);
}

export async function removeShortlistItemAction(formData: FormData) {
  const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
  const user = await getCurrentUser();
  if (!user || user.role !== "agency_member" || !user.agencyId) {
    redirect("/login");
  }

  const itemId = String(formData.get("item_id") ?? "").trim();
  const campaignId = String(formData.get("campaign_id") ?? "").trim();
  if (!itemId || !campaignId) {
    redirect(`/agency/campaigns/${campaignId}?error=invalid_input`);
  }
  if (!(await assertCampaignAgency(campaignId, user.agencyId))) {
    redirect("/agency/campaigns?error=campaign_not_found");
  }

  const admin = createSupabaseAdminClient();
  await admin
    .from("campaign_shortlist_items")
    .delete()
    .eq("id", itemId)
    .eq("campaign_id", campaignId);

  revalidatePath(`/agency/campaigns/${campaignId}`);
  redirect(`/agency/campaigns/${campaignId}?item_removed=1`);
}

export async function sendPackageToBrandAction(formData: FormData) {
  const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
  const user = await getCurrentUser();
  if (!user || user.role !== "agency_member" || !user.agencyId) {
    redirect("/login");
  }

  const campaignId = String(formData.get("campaign_id") ?? "").trim();
  if (!campaignId) redirect("/agency/campaigns?error=invalid_input");
  if (!(await assertCampaignAgency(campaignId, user.agencyId))) {
    redirect("/agency/campaigns?error=campaign_not_found");
  }

  const admin = createSupabaseAdminClient();

  // Load campaign + brand + shortlist for snapshot.
  const { data: camp } = await admin
    .from("campaigns")
    .select(
      `id, name, brief, total_budget_inr_paise, start_date, end_date,
       agencies ( name ),
       brands ( name, contact_email )`,
    )
    .eq("id", campaignId)
    .single();
  if (!camp) redirect(`/agency/campaigns/${campaignId}?error=not_found`);

  const brand: { name?: string; contact_email?: string } = Array.isArray(
    (camp as { brands: unknown }).brands,
  )
    ? (((camp as { brands: unknown[] }).brands[0] ?? {}) as {
        name?: string;
        contact_email?: string;
      })
    : (((camp as { brands: unknown }).brands ?? {}) as {
        name?: string;
        contact_email?: string;
      });
  const agency: { name?: string } = Array.isArray((camp as { agencies: unknown }).agencies)
    ? (((camp as { agencies: unknown[] }).agencies[0] ?? {}) as { name?: string })
    : (((camp as { agencies: unknown }).agencies ?? {}) as { name?: string });

  const { data: items } = await admin
    .from("campaign_shortlist_items")
    .select(
      `id, rationale, proposed_cost_inr_paise, brand_price_inr_paise,
       deliverables, sample_urls,
       influencers!inner (
         id, display_name, instagram_handle, youtube_handle,
         follower_count_total, engagement_rate, city, niches, bio
       )`,
    )
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });

  if (!items || items.length === 0) {
    redirect(`/agency/campaigns/${campaignId}?error=empty_shortlist`);
  }

  // Determine next version number.
  const { data: prev } = await admin
    .from("package_versions")
    .select("version_number")
    .eq("campaign_id", campaignId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = (prev?.version_number ?? 0) + 1;

  const snapshot = {
    campaign: {
      id: (camp as { id: string }).id,
      name: (camp as { name: string }).name,
      brief: (camp as { brief: string | null }).brief,
      total_budget_inr_paise: (camp as { total_budget_inr_paise: number })
        .total_budget_inr_paise,
      start_date: (camp as { start_date: string | null }).start_date,
      end_date: (camp as { end_date: string | null }).end_date,
    },
    agency: { name: agency.name ?? null },
    brand: { name: brand.name ?? null },
    items: items.map((it: unknown) => {
      const row = it as {
        id: string;
        rationale: string | null;
        proposed_cost_inr_paise: number;
        brand_price_inr_paise: number;
        deliverables: unknown;
        sample_urls: string[];
        influencers: unknown;
      };
      const inf = Array.isArray(row.influencers) ? row.influencers[0] : row.influencers;
      return {
        id: row.id,
        rationale: row.rationale,
        // Brand snapshot omits agency cost — only brand price is shown to brand.
        brand_price_inr_paise: row.brand_price_inr_paise,
        deliverables: row.deliverables,
        sample_urls: row.sample_urls,
        influencer: inf,
      };
    }),
    snapshot_taken_at: new Date().toISOString(),
  };

  const { data: version, error: versionErr } = await admin
    .from("package_versions")
    .insert({
      campaign_id: campaignId,
      version_number: nextVersion,
      sent_to_email: brand.contact_email ?? null,
      sent_by_profile_id: user.id,
      snapshot,
    })
    .select("id")
    .single();

  if (versionErr || !version) {
    redirect(
      `/agency/campaigns/${campaignId}?error=${encodeURIComponent(
        versionErr?.message ?? "snapshot_failed",
      )}`,
    );
  }

  // Set campaign to pitching status.
  await admin
    .from("campaigns")
    .update({ status: "pitching" })
    .eq("id", campaignId);

  await admin.from("package_events").insert({
    campaign_id: campaignId,
    package_version_id: version.id,
    actor_kind: "agency",
    actor_profile_id: user.id,
    event_type: "package_sent",
    metadata: {
      version: nextVersion,
      to: brand.contact_email ?? null,
      item_count: items.length,
    },
  });

  // Email the brand with a signed package token.
  if (brand.contact_email) {
    const token = signToken({
      kind: "package",
      campaignId,
      versionId: version.id,
    });
    const url = appUrl(`/p/package/${token}`);
    const totalBrand = (items as unknown as Array<{ brand_price_inr_paise: number }>)
      .reduce((sum, it) => sum + Number(it.brand_price_inr_paise ?? 0), 0);
    const { subject, html, text } = buildPackageEmail({
      brandName: brand.name ?? "there",
      agencyName: agency.name ?? "the agency",
      campaignName: (camp as { name: string }).name,
      totalInr: formatPaiseAsINR(totalBrand),
      packageUrl: url,
      versionNumber: nextVersion,
    });
    const result = await sendEmail({
      to: brand.contact_email,
      subject,
      html,
      text,
    });
    await admin.from("audit_log").insert({
      actor_profile_id: user.id,
      entity_type: "package_version",
      entity_id: version.id,
      action: result.ok ? "package_sent" : "package_send_failed",
      metadata: result.ok
        ? {
            provider: "resend",
            email_id: result.id,
            to: brand.contact_email,
            version: nextVersion,
          }
        : {
            provider: "resend",
            reason: result.reason,
            error: result.message,
            version: nextVersion,
          },
    });
  } else {
    await admin.from("audit_log").insert({
      actor_profile_id: user.id,
      entity_type: "package_version",
      entity_id: version.id,
      action: "package_snapshot_no_email",
      metadata: { version: nextVersion },
    });
  }

  revalidatePath(`/agency/campaigns/${campaignId}`);
  redirect(`/agency/campaigns/${campaignId}?package_sent=${nextVersion}`);
}

function buildPackageEmail(p: {
  brandName: string;
  agencyName: string;
  campaignName: string;
  totalInr: string;
  packageUrl: string;
  versionNumber: number;
}) {
  const subject = `${p.agencyName} sent you a campaign package — ${p.campaignName}`;
  const html = `
    <p>Hi ${escapeHtml(p.brandName)},</p>
    <p><strong>${escapeHtml(p.agencyName)}</strong> has put together a proposal for
    <strong>${escapeHtml(p.campaignName)}</strong>.</p>
    <p>Total: <strong>${escapeHtml(p.totalInr)}</strong> · Version ${p.versionNumber}</p>
    <p><a href="${p.packageUrl}">Review the package</a> — approve, reject,
    or leave comments per creator.</p>
    <p style="color:#666;font-size:12px">This link is unique to you. Do not forward.</p>
  `;
  const text = [
    `Hi ${p.brandName},`,
    `${p.agencyName} has sent you a campaign package — ${p.campaignName}.`,
    `Total: ${p.totalInr} · Version ${p.versionNumber}`,
    `Review: ${p.packageUrl}`,
  ].join("\n\n");
  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
