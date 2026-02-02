import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { verifyOrgMembership, hasMinimumRole } from "./organization";
import type { Role } from "@prisma/client";

// Mock Prisma client
const mockFindUnique = vi.fn();
const mockDb = {
  organizationMember: {
    findUnique: mockFindUnique,
  },
};

describe("organization middleware utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("verifyOrgMembership", () => {
    const userId = "user-123";
    const organizationId = "org-456";

    it("returns membership when user is a member", async () => {
      const mockMembership = {
        id: "member-1",
        role: "EDITOR" as Role,
        organization: {
          id: organizationId,
          name: "Test Org",
          slug: "test-org",
        },
      };
      mockFindUnique.mockResolvedValue(mockMembership);

      const result = await verifyOrgMembership(
        mockDb as any,
        userId,
        organizationId
      );

      expect(result).toEqual(mockMembership);
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: {
          organizationId_userId: {
            organizationId,
            userId,
          },
        },
        include: { organization: true },
      });
    });

    it("throws FORBIDDEN when user is not a member", async () => {
      mockFindUnique.mockResolvedValue(null);

      await expect(
        verifyOrgMembership(mockDb as any, userId, organizationId)
      ).rejects.toThrow(TRPCError);

      await expect(
        verifyOrgMembership(mockDb as any, userId, organizationId)
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });
  });

  describe("hasMinimumRole", () => {
    it("OWNER has access to all roles", () => {
      expect(hasMinimumRole("OWNER", "OWNER")).toBe(true);
      expect(hasMinimumRole("OWNER", "ADMIN")).toBe(true);
      expect(hasMinimumRole("OWNER", "EDITOR")).toBe(true);
      expect(hasMinimumRole("OWNER", "VIEWER")).toBe(true);
    });

    it("ADMIN has access to ADMIN and below", () => {
      expect(hasMinimumRole("ADMIN", "OWNER")).toBe(false);
      expect(hasMinimumRole("ADMIN", "ADMIN")).toBe(true);
      expect(hasMinimumRole("ADMIN", "EDITOR")).toBe(true);
      expect(hasMinimumRole("ADMIN", "VIEWER")).toBe(true);
    });

    it("EDITOR has access to EDITOR and below", () => {
      expect(hasMinimumRole("EDITOR", "OWNER")).toBe(false);
      expect(hasMinimumRole("EDITOR", "ADMIN")).toBe(false);
      expect(hasMinimumRole("EDITOR", "EDITOR")).toBe(true);
      expect(hasMinimumRole("EDITOR", "VIEWER")).toBe(true);
    });

    it("VIEWER only has VIEWER access", () => {
      expect(hasMinimumRole("VIEWER", "OWNER")).toBe(false);
      expect(hasMinimumRole("VIEWER", "ADMIN")).toBe(false);
      expect(hasMinimumRole("VIEWER", "EDITOR")).toBe(false);
      expect(hasMinimumRole("VIEWER", "VIEWER")).toBe(true);
    });
  });

  describe("role hierarchy edge cases", () => {
    it("handles exact role matches", () => {
      const roles: Role[] = ["OWNER", "ADMIN", "EDITOR", "VIEWER"];
      roles.forEach((role) => {
        expect(hasMinimumRole(role, role)).toBe(true);
      });
    });
  });
});
