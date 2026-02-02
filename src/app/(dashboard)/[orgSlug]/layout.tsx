import { notFound } from "next/navigation";

import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { DashboardSidebar } from "~/components/layout/dashboard-sidebar";
import { OrganizationProvider } from "~/contexts/organization-context";

interface OrgLayoutProps {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}

export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { orgSlug } = await params;
  const session = await getSession();

  if (!session) {
    notFound();
  }

  // Verify org exists and user is a member
  const org = await db.organization.findUnique({
    where: { slug: orgSlug },
  });

  if (!org) {
    notFound();
  }

  const membership = await db.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: session.user.id,
      },
    },
  });

  if (!membership) {
    notFound();
  }

  return (
    <OrganizationProvider
      organization={{ id: org.id, name: org.name, slug: org.slug }}
      memberRole={membership.role}
    >
      <div className="flex">
        <DashboardSidebar />
        <main className="flex-1 md:ml-56">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </OrganizationProvider>
  );
}
