import { PersonaShell } from "@/components/PersonaShell";
import { requireRole } from "@/lib/auth/getCurrentUser";

export default async function InfluencerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("influencer");
  return (
    <PersonaShell
      persona="Influencer"
      user={{ fullName: user.fullName, email: user.email }}
      nav={[
        { href: "/influencer", label: "Dashboard" },
        { href: "/influencer/invitations", label: "Invitations" },
        { href: "/influencer/contracts", label: "Contracts" },
        { href: "/influencer/payouts", label: "Payouts" },
      ]}
    >
      {children}
    </PersonaShell>
  );
}
