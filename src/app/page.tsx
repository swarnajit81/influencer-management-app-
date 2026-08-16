import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <TopNav />
      <Hero />
      <FlowSection />
      <PreviewSection />
      <FeatureGrid />
      <PositioningSection />
      <CtaSection />
      <Footer />
    </div>
  );
}

function TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b hairline backdrop-blur-md">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[var(--background)]/80"
      />
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-[var(--accent)] text-[10px] font-semibold text-white">
            PR
          </span>
          <span className="text-[14px] font-medium tracking-tight">
            PR Platform
          </span>
        </Link>
        <div className="flex items-center gap-1 text-[13px]">
          <Link
            href="#how"
            className="rounded-md px-3 py-1.5 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
          >
            How it works
          </Link>
          <Link
            href="#product"
            className="rounded-md px-3 py-1.5 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
          >
            Product
          </Link>
          <Link
            href="/login"
            className="rounded-md px-3 py-1.5 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
          >
            Log in
          </Link>
          <Link href="/signup" className="btn-dark ml-2">
            Get started
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="grid-bg relative overflow-hidden border-b hairline">
      <div className="mx-auto max-w-6xl px-6 pb-24 pt-24 sm:pb-32 sm:pt-32">
        <p className="eyebrow animate-in">For Indian PR agencies</p>
        <h1 className="display animate-in mt-4 text-5xl leading-[1.02] sm:text-7xl">
          The pitch loop,{" "}
          <span className="text-[var(--accent)]">on the record.</span>
        </h1>
        <p className="animate-in mt-6 max-w-2xl text-[17px] leading-relaxed text-[var(--muted)]">
          One workspace for the shortlist you send, the price you quote, the
          decision the brand makes, and the message they send back. Every
          touch timestamped. No more version drift in Gmail or approvals
          buried in WhatsApp.
        </p>

        <div className="animate-in mt-10 flex flex-wrap items-center gap-3">
          <Link href="/signup" className="btn-dark">
            Start free
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
          <Link href="#product" className="btn-ghost">
            See the product
          </Link>
          <span className="ml-2 text-[12px] text-[var(--subtle)]">
            No credit card · Ready in 60 seconds
          </span>
        </div>

        {/* Signal row — 3 tiny anchor stats to reward scanners. */}
        <div className="animate-in mt-14 grid grid-cols-2 gap-8 border-t pt-8 hairline sm:grid-cols-4">
          <SignalStat label="Version drift" value="0" hint="Snapshot per send" />
          <SignalStat
            label="Brand friction"
            value="Zero"
            hint="No signup for brand"
          />
          <SignalStat
            label="Audit gaps"
            value="None"
            hint="Every touch logged"
          />
          <SignalStat
            label="Currency"
            value="INR"
            hint="Paise, no float drift"
          />
        </div>
      </div>
    </section>
  );
}

function SignalStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="display mt-2 text-3xl tabular">{value}</div>
      <div className="mt-1 text-[12px] text-[var(--subtle)]">{hint}</div>
    </div>
  );
}

function FlowSection() {
  const steps = [
    {
      n: "01",
      title: "Build the shortlist",
      body: "Pick creators from your private roster. Rate cards autofill; you set the brand price. Margin visible before you send.",
    },
    {
      n: "02",
      title: "Send the package",
      body: "One click freezes a numbered snapshot and generates a signed link. Brand opens it — no login, no app.",
    },
    {
      n: "03",
      title: "Brand decides",
      body: "Approve, reject, or request revision per creator with a comment. Each action pings your inbox instantly.",
    },
    {
      n: "04",
      title: "Talk it out inline",
      body: "Per-campaign message thread on the same page. No parallel WhatsApp thread to reconcile.",
    },
  ];

  return (
    <section id="how" className="border-b hairline">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-10 sm:grid-cols-[minmax(0,1fr)_2fr]">
          <div>
            <p className="eyebrow">How it works</p>
            <h2 className="display mt-3 text-4xl">
              Four steps.<br />
              Zero screenshots.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--muted)]">
              The workflow you already run — the shortlist, the pitch, the
              back-and-forth — but every step leaves a receipt.
            </p>
          </div>

          <ol className="grid gap-px overflow-hidden rounded-lg border hairline bg-[var(--border)] sm:grid-cols-2">
            {steps.map((s) => (
              <li key={s.n} className="bg-[var(--surface)] p-6">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium tabular text-[var(--accent)]">
                    {s.n}
                  </span>
                  <span className="h-px flex-1 bg-[var(--border)]" />
                </div>
                <h3 className="mt-3 text-[15px] font-semibold">{s.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted)]">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function PreviewSection() {
  return (
    <section id="product" className="grid-bg border-b hairline">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-10 sm:grid-cols-[2fr_minmax(0,1fr)]">
          <div>
            <p className="eyebrow">The brand-facing view</p>
            <h2 className="display mt-3 text-4xl">
              A link that answers{" "}
              <span className="text-[var(--accent)]">before</span> they ask.
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--muted)]">
              No dashboards to learn. Brand opens one URL and sees the
              creators, the deliverables, the price, and every decision they
              or you have made — always the latest.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Chip>Package snapshot</Chip>
              <Chip>Per-creator approve / reject</Chip>
              <Chip>Inline chat</Chip>
              <Chip>Revision request</Chip>
            </div>
          </div>

          {/* Faux product preview — a stylised package card. */}
          <div className="animate-in relative">
            <div
              aria-hidden
              className="absolute -inset-8 -z-10 rounded-2xl bg-[var(--accent-soft)] blur-2xl"
            />
            <div className="panel overflow-hidden">
              <div className="border-b hairline px-4 py-2">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[var(--border-strong)]" />
                  <span className="h-2 w-2 rounded-full bg-[var(--border-strong)]" />
                  <span className="h-2 w-2 rounded-full bg-[var(--border-strong)]" />
                  <span className="ml-3 text-[11px] tabular text-[var(--subtle)]">
                    /p/package/…
                  </span>
                </div>
              </div>
              <div className="p-5">
                <p className="eyebrow">Sattva Ayurveda → Kirti Media</p>
                <p className="mt-2 text-[15px] font-semibold">Diwali &apos;26 Skincare</p>
                <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--subtle)]">
                  Version 2 · sent 3 Oct
                </p>
                <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-md border hairline bg-[var(--border)] text-center">
                  <MiniStat n="4" l="Creators" />
                  <MiniStat n="₹3.6L" l="Total" />
                  <MiniStat n="2·0·2" l="A·R·P" />
                </div>
                <ul className="mt-4 space-y-2">
                  <RowPreview name="Aditi Iyer" price="₹90,000" state="approved" />
                  <RowPreview name="Rohan Nair" price="₹1,20,000" state="pending" />
                  <RowPreview name="Zara Bose" price="₹80,000" state="approved" />
                  <RowPreview name="Priya Menon" price="₹70,000" state="pending" />
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MiniStat({ n, l }: { n: string; l: string }) {
  return (
    <div className="bg-[var(--surface)] px-2 py-2">
      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--subtle)]">
        {l}
      </div>
      <div className="mt-1 text-[13px] font-semibold tabular">{n}</div>
    </div>
  );
}

function RowPreview({
  name,
  price,
  state,
}: {
  name: string;
  price: string;
  state: "approved" | "pending";
}) {
  const dot = state === "approved" ? "bg-emerald-500" : "bg-amber-400";
  const label = state === "approved" ? "approved" : "pending";
  return (
    <li className="flex items-center justify-between rounded-md border px-3 py-2 hairline">
      <div className="flex items-center gap-2">
        <span className={`signal-dot ${dot}`} />
        <span className="text-[13px] font-medium">{name}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--subtle)]">
          {label}
        </span>
        <span className="text-[13px] font-semibold tabular">{price}</span>
      </div>
    </li>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] text-[var(--muted)] hairline">
      <span className="signal-dot bg-[var(--accent)]" />
      {children}
    </span>
  );
}

function FeatureGrid() {
  const features = [
    {
      title: "Snapshotted packages",
      body: "Prices freeze the moment you send. Brand always sees the version you meant, not a moving target.",
      hint: "package_versions",
    },
    {
      title: "Event log per campaign",
      body: "Viewed, approved, rejected, revision-requested, message-sent — timestamped with actor. Disputes end with a link.",
      hint: "package_events",
    },
    {
      title: "Per-creator margin",
      body: "Creator cost and brand price side-by-side on the same row. Margin is calculable, not guessed.",
      hint: "shortlist row",
    },
    {
      title: "Agency-only login",
      body: "Your team signs in with a magic link. Brand touches the platform through a signed URL — no account to onboard.",
      hint: "0 seats for brand",
    },
    {
      title: "Per-member unread state",
      body: "Every account manager sees their own unread badge. Nothing silently marked read by a teammate.",
      hint: "agency_members.last_inbox_seen_at",
    },
    {
      title: "Paise-native",
      body: "Every rupee stored as paise (bigint). No float drift on quarterly reconciliation.",
      hint: "bigint paise",
    },
  ];

  return (
    <section className="border-b hairline">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-2xl">
          <p className="eyebrow">Built for the pitch</p>
          <h2 className="display mt-3 text-4xl">
            Six primitives.<br />One system of record.
          </h2>
        </div>

        <div className="mt-10 grid gap-px overflow-hidden rounded-lg border hairline bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group bg-[var(--surface)] p-6 transition-colors hover:bg-[var(--surface-elevated)]"
            >
              <div className="flex items-baseline justify-between">
                <h3 className="text-[15px] font-semibold">{f.title}</h3>
                <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--subtle)] group-hover:text-[var(--accent)]">
                  {f.hint}
                </span>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-[var(--muted)]">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PositioningSection() {
  return (
    <section className="border-b hairline">
      <div className="mx-auto max-w-4xl px-6 py-24 text-center">
        <p className="eyebrow">The promise</p>
        <p className="display mt-4 text-3xl leading-[1.15] sm:text-4xl">
          Your brand will stop asking &ldquo;where are we?&rdquo;{" "}
          <span className="text-[var(--muted)]">
            because the answer is always one link away, and it&apos;s the same
            answer everyone in the room can see.
          </span>
        </p>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="grid-bg border-b hairline">
      <div className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h2 className="display text-4xl sm:text-5xl">
          Put one real pitch through it.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[15px] text-[var(--muted)]">
          Sign up in 60 seconds. Bring one campaign. Tell us what broke.
          Pilot agencies get white-glove onboarding.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/signup" className="btn-dark">
            Start free
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
          <Link href="/login" className="btn-ghost">
            Log in
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-[12px] text-[var(--subtle)]">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[var(--accent)] text-[9px] font-semibold text-white">
            PR
          </span>
          <span>PR Platform</span>
          <span className="text-[var(--border-strong)]">·</span>
          <span>Made in India</span>
        </div>
        <div className="flex gap-4">
          <Link href="/terms" className="hover:text-[var(--foreground)]">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-[var(--foreground)]">
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}
