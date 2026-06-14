/* eslint-disable @typescript-eslint/no-explicit-any */
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyToken, type VerifyResult } from "@/lib/tokens";
import { formatPaiseAsINR } from "@/lib/money";
import {
  acceptInvitationViaTokenAction,
  declineInvitationViaTokenAction,
} from "./actions";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ accepted?: string; declined?: string; error?: string }>;
};

export default async function InvitationPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { accepted, declined, error } = await searchParams;

  const verified = verifyToken(token);
  if (!verified.ok) {
    return <ErrorShell title={titleForVerifyError(verified)} body={bodyForVerifyError(verified)} />;
  }
  if (verified.payload.kind !== "invitation") {
    return <ErrorShell title="Link not recognised" body="This link isn't an invitation link." />;
  }

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("campaign_invitations")
    .select(
      `id, status, offer_amount_inr_paise, offer_message, deliverables_summary,
       expires_at,
       campaigns!inner ( name, brief,
                         agencies ( name ), brands ( name ) ),
       influencers!inner ( display_name, profiles ( full_name ) )`,
    )
    .eq("id", verified.payload.invitationId)
    .single();

  if (!data) {
    return <ErrorShell title="Invitation not found" body="The invitation linked here no longer exists." />;
  }

  const inv = data as any;
  const campaign = Array.isArray(inv.campaigns) ? inv.campaigns[0] : inv.campaigns;
  const agency = Array.isArray(campaign?.agencies) ? campaign.agencies[0] : campaign?.agencies;
  const brand = Array.isArray(campaign?.brands) ? campaign.brands[0] : campaign?.brands;
  const influencer = Array.isArray(inv.influencers) ? inv.influencers[0] : inv.influencers;
  const profile = Array.isArray(influencer?.profiles)
    ? influencer.profiles[0]
    : influencer?.profiles;

  const greeting = influencer?.display_name ?? profile?.full_name ?? "there";
  const offer = formatPaiseAsINR(inv.offer_amount_inr_paise);

  if (accepted) {
    return (
      <Shell>
        <Banner kind="success">You accepted the invitation. The agency has been notified.</Banner>
        <Summary
          greeting={greeting}
          agencyName={agency?.name}
          brandName={brand?.name}
          campaignName={campaign?.name}
          offer={offer}
        />
        <p className="mt-6 text-sm text-zinc-500">
          We&apos;ll email you next steps for signing the contract and submitting deliverables.
        </p>
      </Shell>
    );
  }

  if (declined) {
    return (
      <Shell>
        <Banner kind="muted">You declined this invitation. Thanks for the quick response.</Banner>
        <Summary
          greeting={greeting}
          agencyName={agency?.name}
          brandName={brand?.name}
          campaignName={campaign?.name}
          offer={offer}
        />
      </Shell>
    );
  }

  if (inv.status !== "pending") {
    return (
      <Shell>
        <Banner kind="muted">
          This invitation is already {inv.status.replace("_", " ")}.
        </Banner>
        <Summary
          greeting={greeting}
          agencyName={agency?.name}
          brandName={brand?.name}
          campaignName={campaign?.name}
          offer={offer}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      {error && <Banner kind="error">{humanError(error)}</Banner>}

      <h1 className="text-2xl font-semibold">Campaign invitation</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Hi {greeting}, <strong>{agency?.name ?? "An agency"}</strong> has invited
        you to collaborate on a campaign for{" "}
        <strong>{brand?.name ?? "their brand"}</strong>.
      </p>

      <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <Row label="Campaign" value={campaign?.name ?? "—"} />
        <Row label="Brand" value={brand?.name ?? "—"} />
        <Row label="Offer" value={<span className="text-lg font-semibold">{offer}</span>} />
        {inv.deliverables_summary && (
          <Row label="Deliverables" value={<span className="whitespace-pre-wrap">{inv.deliverables_summary}</span>} />
        )}
        {campaign?.brief && (
          <Row label="Brief" value={<span className="whitespace-pre-wrap">{campaign.brief}</span>} />
        )}
        {inv.offer_message && (
          <Row label={`Message from ${agency?.name ?? "the agency"}`} value={<span className="whitespace-pre-wrap">{inv.offer_message}</span>} />
        )}
      </section>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <form action={acceptInvitationViaTokenAction}>
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="w-full rounded-md bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Accept &amp; sign
          </button>
        </form>
        <form action={declineInvitationViaTokenAction}>
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="w-full rounded-md border border-zinc-300 px-4 py-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Decline
          </button>
        </form>
      </div>

      <p className="mt-6 text-xs text-zinc-500">
        By clicking &quot;Accept &amp; sign&quot; you agree to the contract terms for this campaign. A signed PDF will be emailed to you.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto max-w-2xl px-6 py-12 text-zinc-900 dark:text-zinc-50">
        {children}
      </main>
    </div>
  );
}

function ErrorShell({ title, body }: { title: string; body: string }) {
  return (
    <Shell>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-zinc-500">{body}</p>
      <p className="mt-6 text-xs text-zinc-500">
        If you think this is a mistake, reply to the email that brought you here and the agency can issue a new link.
      </p>
    </Shell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-b border-zinc-100 py-3 first:pt-0 last:border-b-0 last:pb-0 dark:border-zinc-800">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

function Summary({
  greeting,
  agencyName,
  brandName,
  campaignName,
  offer,
}: {
  greeting: string;
  agencyName?: string;
  brandName?: string;
  campaignName?: string;
  offer: string;
}) {
  return (
    <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm text-zinc-500">Hi {greeting},</p>
      <p className="mt-1 text-sm">
        <strong>{agencyName ?? "Agency"}</strong> · <strong>{brandName ?? "Brand"}</strong>
      </p>
      <p className="mt-1 text-sm">{campaignName ?? "Campaign"}</p>
      <p className="mt-2 text-lg font-semibold">{offer}</p>
    </section>
  );
}

function Banner({
  kind,
  children,
}: {
  kind: "success" | "error" | "muted";
  children: React.ReactNode;
}) {
  const styles =
    kind === "success"
      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
      : kind === "error"
        ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
        : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
  return <div className={`rounded-md px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

function titleForVerifyError(v: VerifyResult & { ok: false }): string {
  switch (v.reason) {
    case "expired":
      return "This invitation link has expired";
    case "bad_signature":
    case "malformed":
      return "This link isn't valid";
    case "no_secret":
      return "Server misconfiguration";
  }
}

function bodyForVerifyError(v: VerifyResult & { ok: false }): string {
  switch (v.reason) {
    case "expired":
      return "Ask the agency to send you a new invitation email.";
    case "bad_signature":
    case "malformed":
      return "The link may be incomplete or tampered with. Open the original email and click again.";
    case "no_secret":
      return "Token verification is unavailable. The agency has been notified.";
  }
}

function humanError(code: string): string {
  if (code.startsWith("already_")) {
    return `This invitation is already ${code.slice("already_".length).replace("_", " ")}.`;
  }
  switch (code) {
    case "not_found":
      return "Invitation not found.";
    case "wrong_kind":
      return "This link isn't an invitation link.";
    case "contract_create_failed":
      return "We couldn't create the contract. Try again or contact the agency.";
    default:
      return decodeURIComponent(code);
  }
}
