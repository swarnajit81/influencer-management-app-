import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/getCurrentUser";
import { formatPaiseAsINR } from "@/lib/money";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Awaiting your signature",
  signed_by_influencer: "Signed — awaiting brand",
  signed_by_brand: "Signed by brand — awaiting you",
  fully_signed: "Fully signed",
  cancelled: "Cancelled",
};

export default async function InfluencerContracts({
  searchParams,
}: {
  searchParams: Promise<{ contract?: string; error?: string }>;
}) {
  const { contract: highlightId, error } = await searchParams;
  const user = await requireRole("influencer");

  const supabase = await createSupabaseServerClient();
  const { data: contracts } = await supabase
    .from("contracts")
    .select(
      `
      id, status, total_amount_inr_paise, payment_terms,
      digio_document_id, influencer_signing_url, signed_pdf_url,
      signing_expires_at, influencer_signed_at, brand_signed_at, created_at,
      campaigns ( id, name, brands ( name ), agencies ( name ) )
    `,
    )
    .eq("influencer_id", user.influencerId)
    .order("created_at", { ascending: false });

  const needsSig =
    contracts?.filter((c: any) =>
      ["sent", "signed_by_brand"].includes(c.status),
    ) ?? [];
  const signed =
    contracts?.filter((c: any) => ["signed_by_influencer", "fully_signed"].includes(c.status)) ?? [];
  const other =
    contracts?.filter((c: any) => ["draft", "cancelled"].includes(c.status)) ?? [];

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">Contracts</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Campaign contracts you have accepted.
      </p>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {decodeURIComponent(error)}
        </div>
      )}
      {highlightId && (
        <div className="mt-4 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          Invitation accepted. Contract on file under <b>Signed</b>.
        </div>
      )}

      <Section title="Awaiting your signature" empty="Nothing to sign right now.">
        {needsSig.map((c: any) => (
          <ContractCard key={c.id} c={c} highlight={c.id === highlightId} />
        ))}
      </Section>

      <Section title="Signed">
        {signed.map((c: any) => (
          <ContractCard key={c.id} c={c} />
        ))}
      </Section>

      {other.length > 0 && (
        <Section title="Other">
          {other.map((c: any) => (
            <ContractCard key={c.id} c={c} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  children,
  empty,
}: {
  title: string;
  children: React.ReactNode;
  empty?: string;
}) {
  const arr = Array.isArray(children) ? children : [children];
  const hasItems = arr.filter(Boolean).length > 0;
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {hasItems ? (
        <div className="space-y-3">{children}</div>
      ) : empty ? (
        <p className="text-sm text-zinc-500">{empty}</p>
      ) : null}
    </section>
  );
}

function ContractCard({ c, highlight }: { c: any; highlight?: boolean }) {
  const camp = Array.isArray(c.campaigns) ? c.campaigns[0] : c.campaigns;
  const brand = Array.isArray(camp?.brands) ? camp.brands[0] : camp?.brands;
  const agency = Array.isArray(camp?.agencies) ? camp.agencies[0] : camp?.agencies;
  const canSign =
    ["sent", "signed_by_brand"].includes(c.status) &&
    !!c.influencer_signing_url &&
    !c.influencer_signed_at;

  return (
    <div
      className={`rounded-lg border p-5 ${
        highlight
          ? "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{camp?.name}</h3>
          <p className="text-sm text-zinc-500">
            {brand?.name} · via {agency?.name}
          </p>
        </div>
        <p className="text-lg font-semibold">
          {formatPaiseAsINR(c.total_amount_inr_paise)}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
        <span>
          Status:{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {STATUS_LABEL[c.status] ?? c.status}
          </span>
        </span>
        {c.signing_expires_at && (
          <span>Expires: {new Date(c.signing_expires_at).toLocaleDateString()}</span>
        )}
        {c.influencer_signed_at && (
          <span>You signed: {new Date(c.influencer_signed_at).toLocaleDateString()}</span>
        )}
        {c.brand_signed_at && (
          <span>Brand signed: {new Date(c.brand_signed_at).toLocaleDateString()}</span>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={`/influencer/contracts/${c.id}`}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Manage deliverables →
        </Link>
        {canSign && (
          <a
            href={c.influencer_signing_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Sign now (Aadhaar e-sign) →
          </a>
        )}
        {c.signed_pdf_url && (
          <a
            href={c.signed_pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Download signed PDF
          </a>
        )}
      </div>
    </div>
  );
}
