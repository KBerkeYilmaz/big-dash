import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getSession } from "~/server/better-auth/server";
import { DashboardHeader } from "~/components/layout/dashboard-header";
import { Skeleton } from "~/components/ui/skeleton";

/**
 * Async component that handles session verification
 * Wrapped in Suspense to support cacheComponents
 */
async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <>
      <DashboardHeader user={session.user} />
      {children}
    </>
  );
}

/**
 * Loading skeleton for dashboard header
 */
function DashboardSkeleton() {
  return (
    <div className="border-b">
      <div className="flex h-16 items-center px-4 gap-4">
        <Skeleton className="h-8 w-32" />
        <div className="ml-auto flex items-center gap-4">
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<DashboardSkeleton />}>
        <AuthenticatedLayout>{children}</AuthenticatedLayout>
      </Suspense>
    </div>
  );
}
