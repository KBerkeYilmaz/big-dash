import { TRPCError } from "@trpc/server";
import type { Role, PrismaClient } from "@prisma/client";

/**
 * Role hierarchy - higher index = more permissions
 */
const ROLE_HIERARCHY: Record<Role, number> = {
  VIEWER: 0,
  EDITOR: 1,
  ADMIN: 2,
  OWNER: 3,
};

/**
 * Organization context added by the middleware
 */
export interface OrgContext {
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  memberRole: Role;
}

/**
 * Check if a user's role meets or exceeds the minimum required role
 */
export function hasMinimumRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Verify that a user is a member of an organization
 * Returns the membership with organization data, or throws FORBIDDEN
 */
export async function verifyOrgMembership(
  db: PrismaClient,
  userId: string,
  organizationId: string
) {
  const membership = await db.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    include: { organization: true },
  });

  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Not a member of this organization",
    });
  }

  return membership;
}

/**
 * Assert that a user has at least the required role
 * Throws FORBIDDEN if they don't
 */
export function assertRole(userRole: Role, requiredRole: Role): void {
  if (!hasMinimumRole(userRole, requiredRole)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `${requiredRole} access required`,
    });
  }
}
