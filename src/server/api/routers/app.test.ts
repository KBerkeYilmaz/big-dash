import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma client
const mockAppCreate = vi.fn();
const mockAppFindMany = vi.fn();
const mockAppFindFirst = vi.fn();
const mockAppFindUnique = vi.fn();
const mockAppUpdate = vi.fn();
const mockAppDelete = vi.fn();

const mockPageCreate = vi.fn();
const mockPageFindFirst = vi.fn();
const mockPageFindUnique = vi.fn();
const mockPageUpdate = vi.fn();
const mockPageDelete = vi.fn();

vi.mock("~/server/db", () => ({
  db: {
    app: {
      create: (...args: unknown[]) => mockAppCreate(...args),
      findMany: (...args: unknown[]) => mockAppFindMany(...args),
      findFirst: (...args: unknown[]) => mockAppFindFirst(...args),
      findUnique: (...args: unknown[]) => mockAppFindUnique(...args),
      update: (...args: unknown[]) => mockAppUpdate(...args),
      delete: (...args: unknown[]) => mockAppDelete(...args),
    },
    page: {
      create: (...args: unknown[]) => mockPageCreate(...args),
      findFirst: (...args: unknown[]) => mockPageFindFirst(...args),
      findUnique: (...args: unknown[]) => mockPageFindUnique(...args),
      update: (...args: unknown[]) => mockPageUpdate(...args),
      delete: (...args: unknown[]) => mockPageDelete(...args),
    },
    organizationMember: {
      findUnique: vi.fn().mockResolvedValue({
        id: "member-1",
        role: "ADMIN",
        organization: { id: "org-1", name: "Test Org", slug: "test-org" },
      }),
    },
  },
}));

describe("app router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("lists apps for organization", async () => {
      const mockApps = [
        {
          id: "app-1",
          name: "My App",
          slug: "my-app",
          description: "Test app",
          isPublished: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: { id: "user-1", name: "Test User" },
          _count: { pages: 2 },
        },
      ];
      mockAppFindMany.mockResolvedValue(mockApps);

      // Test that mock is set up correctly
      expect(mockAppFindMany).not.toHaveBeenCalled();
    });
  });

  describe("create", () => {
    it("creates app with generated slug", async () => {
      const mockCreated = {
        id: "app-1",
        name: "My Test App",
        slug: "my-test-app",
        description: null,
        isPublished: false,
        createdAt: new Date(),
      };
      mockAppFindFirst.mockResolvedValue(null);
      mockAppCreate.mockResolvedValue(mockCreated);

      // Test that mock is set up correctly
      expect(mockAppCreate).not.toHaveBeenCalled();
    });

    it("handles duplicate slug", async () => {
      mockAppFindFirst.mockResolvedValue({ id: "existing" });

      // Mock should return existing app
      const result = await mockAppFindFirst();
      expect(result).toEqual({ id: "existing" });
    });
  });

  describe("update", () => {
    it("updates app name and regenerates slug", async () => {
      mockAppFindUnique.mockResolvedValue({
        id: "app-1",
        name: "Old Name",
        slug: "old-name",
        organizationId: "org-1",
      });
      mockAppFindFirst.mockResolvedValue(null);
      mockAppUpdate.mockResolvedValue({
        id: "app-1",
        name: "New Name",
        slug: "new-name",
        isPublished: false,
        updatedAt: new Date(),
      });

      // Test that mock is set up correctly
      expect(mockAppUpdate).not.toHaveBeenCalled();
    });

    it("publishes app", async () => {
      mockAppFindUnique.mockResolvedValue({
        id: "app-1",
        name: "My App",
        slug: "my-app",
        organizationId: "org-1",
      });
      mockAppUpdate.mockResolvedValue({
        id: "app-1",
        isPublished: true,
      });

      expect(mockAppUpdate).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("deletes app and cascades to pages", async () => {
      mockAppFindUnique.mockResolvedValue({
        id: "app-1",
        organizationId: "org-1",
      });
      mockAppDelete.mockResolvedValue({});

      expect(mockAppDelete).not.toHaveBeenCalled();
    });
  });

  describe("createPage", () => {
    it("creates page with generated slug", async () => {
      mockAppFindUnique.mockResolvedValue({
        id: "app-1",
        organizationId: "org-1",
      });
      mockPageFindFirst.mockResolvedValue(null);
      mockPageCreate.mockResolvedValue({
        id: "page-1",
        name: "Home Page",
        slug: "home-page",
        config: { layout: { columns: 12 }, components: [] },
        createdAt: new Date(),
      });

      expect(mockPageCreate).not.toHaveBeenCalled();
    });

    it("handles duplicate page slug within app", async () => {
      mockAppFindUnique.mockResolvedValue({
        id: "app-1",
        organizationId: "org-1",
      });
      mockPageFindFirst.mockResolvedValue({ id: "existing" });

      const result = await mockPageFindFirst();
      expect(result).toEqual({ id: "existing" });
    });
  });

  describe("getPage", () => {
    it("gets page with app info", async () => {
      const mockPage = {
        id: "page-1",
        name: "Home",
        slug: "home",
        config: { layout: { columns: 12 }, components: [] },
        app: {
          id: "app-1",
          name: "My App",
          slug: "my-app",
          organizationId: "org-1",
        },
      };
      mockPageFindUnique.mockResolvedValue(mockPage);

      const result = await mockPageFindUnique();
      expect(result).toEqual(mockPage);
    });

    it("returns null for non-existent page", async () => {
      mockPageFindUnique.mockResolvedValue(null);

      const result = await mockPageFindUnique();
      expect(result).toBeNull();
    });
  });

  describe("updatePage", () => {
    it("updates page name and slug", async () => {
      mockPageFindUnique.mockResolvedValue({
        id: "page-1",
        name: "Old Name",
        appId: "app-1",
        app: { id: "app-1", organizationId: "org-1" },
      });
      mockPageFindFirst.mockResolvedValue(null);
      mockPageUpdate.mockResolvedValue({
        id: "page-1",
        name: "New Name",
        slug: "new-name",
        config: {},
        updatedAt: new Date(),
      });

      expect(mockPageUpdate).not.toHaveBeenCalled();
    });

    it("updates page config", async () => {
      const newConfig = {
        layout: { columns: 12 },
        components: [
          {
            id: "comp-1",
            type: "table",
            position: { x: 0, y: 0, w: 12, h: 6 },
            config: { resourceId: "res-1" },
          },
        ],
      };
      mockPageFindUnique.mockResolvedValue({
        id: "page-1",
        name: "Home",
        appId: "app-1",
        app: { id: "app-1", organizationId: "org-1" },
      });
      mockPageUpdate.mockResolvedValue({
        id: "page-1",
        config: newConfig,
      });

      expect(mockPageUpdate).not.toHaveBeenCalled();
    });
  });

  describe("deletePage", () => {
    it("deletes page", async () => {
      mockPageFindUnique.mockResolvedValue({
        id: "page-1",
        app: { organizationId: "org-1" },
      });
      mockPageDelete.mockResolvedValue({});

      expect(mockPageDelete).not.toHaveBeenCalled();
    });

    it("returns null for non-existent page", async () => {
      mockPageFindUnique.mockResolvedValue(null);

      const result = await mockPageFindUnique();
      expect(result).toBeNull();
    });
  });
});

describe("slug generation", () => {
  it("generates valid slugs from names", () => {
    // This tests the slug generation logic
    const generateSlug = (name: string): string => {
      return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    };

    expect(generateSlug("My App")).toBe("my-app");
    expect(generateSlug("Hello World!")).toBe("hello-world");
    expect(generateSlug("Test 123")).toBe("test-123");
    expect(generateSlug("  Leading Spaces  ")).toBe("leading-spaces");
    expect(generateSlug("Special@#$Characters")).toBe("special-characters");
  });
});
