import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * Organization Router Tests
 *
 * Testing the business logic functions directly rather than through tRPC
 * to keep tests fast and avoid mocking the full tRPC context.
 */

// We'll test the helper functions that the router uses
import {
  generateSlug,
  validateSlug,
  isSlugAvailable,
} from "./organization.helpers";

describe("organization helpers", () => {
  describe("generateSlug", () => {
    it("converts name to lowercase slug", () => {
      expect(generateSlug("My Company")).toBe("my-company");
    });

    it("replaces spaces with hyphens", () => {
      expect(generateSlug("Acme Corp Inc")).toBe("acme-corp-inc");
    });

    it("removes special characters", () => {
      expect(generateSlug("Company & Co.")).toBe("company-co");
    });

    it("collapses multiple hyphens", () => {
      expect(generateSlug("Company  --  Name")).toBe("company-name");
    });

    it("trims leading and trailing hyphens", () => {
      expect(generateSlug("  Company  ")).toBe("company");
      expect(generateSlug("--Company--")).toBe("company");
    });

    it("handles unicode characters", () => {
      expect(generateSlug("Société Générale")).toBe("societe-generale");
    });

    it("handles empty string", () => {
      expect(generateSlug("")).toBe("");
    });
  });

  describe("validateSlug", () => {
    it("accepts valid slugs", () => {
      expect(validateSlug("my-company")).toBe(true);
      expect(validateSlug("acme123")).toBe(true);
      expect(validateSlug("test-org-2024")).toBe(true);
    });

    it("rejects slugs that are too short", () => {
      expect(validateSlug("ab")).toBe(false);
      expect(validateSlug("a")).toBe(false);
    });

    it("rejects slugs that are too long", () => {
      expect(validateSlug("a".repeat(51))).toBe(false);
    });

    it("rejects slugs with invalid characters", () => {
      expect(validateSlug("my_company")).toBe(false);
      expect(validateSlug("my.company")).toBe(false);
      expect(validateSlug("My-Company")).toBe(false);
      expect(validateSlug("my company")).toBe(false);
    });

    it("rejects slugs starting or ending with hyphen", () => {
      expect(validateSlug("-company")).toBe(false);
      expect(validateSlug("company-")).toBe(false);
    });

    it("rejects reserved slugs", () => {
      expect(validateSlug("admin")).toBe(false);
      expect(validateSlug("api")).toBe(false);
      expect(validateSlug("app")).toBe(false);
      expect(validateSlug("settings")).toBe(false);
    });
  });

  describe("isSlugAvailable", () => {
    const mockDb = {
      organization: {
        findUnique: vi.fn(),
      },
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("returns true when slug is not taken", async () => {
      mockDb.organization.findUnique.mockResolvedValue(null);

      const result = await isSlugAvailable(mockDb as any, "new-org");

      expect(result).toBe(true);
      expect(mockDb.organization.findUnique).toHaveBeenCalledWith({
        where: { slug: "new-org" },
        select: { id: true },
      });
    });

    it("returns false when slug is taken", async () => {
      mockDb.organization.findUnique.mockResolvedValue({ id: "existing-id" });

      const result = await isSlugAvailable(mockDb as any, "taken-org");

      expect(result).toBe(false);
    });

    it("returns true when checking same org (for updates)", async () => {
      mockDb.organization.findUnique.mockResolvedValue({ id: "same-org-id" });

      const result = await isSlugAvailable(
        mockDb as any,
        "my-org",
        "same-org-id"
      );

      expect(result).toBe(true);
    });

    it("returns false when slug taken by different org", async () => {
      mockDb.organization.findUnique.mockResolvedValue({ id: "other-org-id" });

      const result = await isSlugAvailable(
        mockDb as any,
        "taken-org",
        "my-org-id"
      );

      expect(result).toBe(false);
    });
  });
});
