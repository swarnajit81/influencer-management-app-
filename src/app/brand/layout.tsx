import { PersonaShell } from "@/components/PersonaShell";
import { requireRole } from "@/lib/auth/getCurrentUser";

export default async function BrandLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("brand_member");
  return (
    <PersonaShell
      persona="Brand"
      user={{ fullName: user.fullName, email: user.email }}
      nav={[
        { href: "/brand", label: "Dashboard" },
        { href: "/brand/campaigns", label: "Campaigns" },
        { href: "/brand/approvals", label: "Approvals" },
      ]}
    >
      {children}
    </PersonaShell>
  );
}
