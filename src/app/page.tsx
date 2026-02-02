import { redirect } from "next/navigation";

import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";

export default async function Home() {
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

  // No organization - redirect to create one
  redirect("/new");
}
