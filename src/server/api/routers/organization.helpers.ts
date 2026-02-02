import type { PrismaClient } from "@prisma/client";

/**
 * Reserved slugs that cannot be used for organizations
 */
const RESERVED_SLUGS = [
  "admin",
  "api",
  "app",
  "auth",
  "dashboard",
  "docs",
  "help",
  "login",
  "logout",
  "register",
  "settings",
  "signup",
  "support",
  "www",
];

/**
 * Generate a URL-safe slug from an organization name
 */
export function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      // Normalize unicode characters (é -> e, ü -> u, etc.)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      // Replace spaces and underscores with hyphens
      .replace(/[\s_]+/g, "-")
      // Remove all non-alphanumeric characters except hyphens
      .replace(/[^a-z0-9-]/g, "")
      // Collapse multiple hyphens into one
      .replace(/-+/g, "-")
      // Trim hyphens from start and end
      .replace(/^-+|-+$/g, "")
  );
}

/**
 * Validate a slug format
 * - 3-50 characters
 * - Only lowercase letters, numbers, and hyphens
 * - Cannot start or end with hyphen
 * - Cannot be a reserved word
 */
export function validateSlug(slug: string): boolean {
  // Check length
  if (slug.length < 3 || slug.length > 50) {
    return false;
  }

  // Check format: lowercase alphanumeric and hyphens only
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return false;
  }

  // Check reserved words
  if (RESERVED_SLUGS.includes(slug)) {
    return false;
  }

  return true;
}

/**
 * Check if a slug is available (not already taken)
 * Optionally exclude a specific organization ID (for updates)
 */
export async function isSlugAvailable(
  db: PrismaClient,
  slug: string,
  excludeOrgId?: string
): Promise<boolean> {
  const existing = await db.organization.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (!existing) {
    return true;
  }

  // If we're updating and it's the same org, the slug is "available"
  if (excludeOrgId && existing.id === excludeOrgId) {
    return true;
  }

  return false;
}
