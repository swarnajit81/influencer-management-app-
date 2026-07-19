import { PersonaShell } from "@/components/PersonaShell";
import { requireAgencyMember } from "@/lib/auth/getCurrentUser";
import { getInboxUnreadCount } from "@/lib/inbox";

export default async function AgencyLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAgencyMember();
  const unread = await getInboxUnreadCount(user.agencyId, user.id);
  return (
    <PersonaShell
      persona="Agency"
      user={{ fullName: user.fullName, email: user.email }}
      nav={[
        { href: "/agency", label: "Dashboard" },
        { href: "/agency/inbox", label: "Inbox", badge: unread },
        { href: "/agency/campaigns", label: "Campaigns" },
        { href: "/agency/brands", label: "Brands" },
        { href: "/agency/influencers", label: "Influencers" },
        { href: "/agency/settings", label: "Settings" },
      ]}
    >
      {children}
    </PersonaShell>
  );
}
