import { redirect } from "next/navigation";

import { getSession } from "~/server/better-auth/server";
import { DashboardHeader } from "~/components/layout/dashboard-header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={session.user} />
      {children}
    </div>
  );
}
