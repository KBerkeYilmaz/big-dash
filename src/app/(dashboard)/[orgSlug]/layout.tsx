import { Suspense } from "react";
import { notFound } from "next/navigation";

import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { DashboardSidebar } from "~/components/layout/dashboard-sidebar";
import { OrganizationProvider } from "~/contexts/organization-context";
import { Skeleton } from "~/components/ui/skeleton";

interface OrgLayoutProps {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}

/**
 * Async component that handles org verification
 * Wrapped in Suspense to support cacheComponents
 */
async function AuthenticatedOrgLayout({
  children,
  orgSlug,
}: {
  children: React.ReactNode;
  orgSlug: string;
}) {
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

/**
 * Loading skeleton for org layout
 */
function OrgLayoutSkeleton() {
  return (
    <div className="flex">
      {/* Sidebar skeleton */}
      <div className="hidden md:flex w-56 flex-col border-r bg-background">
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
      {/* Content skeleton */}
      <main className="flex-1 md:ml-56">
        <div className="p-6">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-32 w-full" />
        </div>
      </main>
    </div>
  );
}

export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { orgSlug } = await params;

  return (
    <Suspense fallback={<OrgLayoutSkeleton />}>
      <AuthenticatedOrgLayout orgSlug={orgSlug}>
        {children}
      </AuthenticatedOrgLayout>
    </Suspense>
  );
}
