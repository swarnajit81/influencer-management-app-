import { PersonaShell } from "@/components/PersonaShell";
import { requireAgencyMember } from "@/lib/auth/getCurrentUser";

export default async function AgencyLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAgencyMember();
  return (
    <PersonaShell
      persona="Agency"
      user={{ fullName: user.fullName, email: user.email }}
      nav={[
        { href: "/agency", label: "Dashboard" },
        { href: "/agency/campaigns", label: "Campaigns" },
        { href: "/agency/brands", label: "Brands" },
        { href: "/agency/influencers", label: "Influencers" },
        { href: "/agency/payouts", label: "Payouts" },
      ]}
    >
      {children}
    </PersonaShell>
  );
}
