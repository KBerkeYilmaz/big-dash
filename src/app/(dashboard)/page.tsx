import { redirect } from "next/navigation";

import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";

/**
 * Dashboard root - redirects to the user's first organization
 * or shows onboarding if they have none
 */
export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Find user's first organization
  const membership = await db.organizationMember.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });

  if (membership) {
    redirect(`/${membership.organization.slug}`);
  }

  // No orgs - redirect to create one
  redirect("/new");
}
