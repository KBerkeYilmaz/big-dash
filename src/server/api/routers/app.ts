import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";

import {
  createTRPCRouter,
  orgEditorProcedure,
  orgAdminProcedure,
} from "~/server/api/trpc";

/**
 * Helper to generate a slug from a name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Page config schema
 */
const pageConfigSchema = z.object({
  layout: z.object({
    columns: z.number().min(1).max(24).default(12),
  }),
  components: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(["table", "form", "detail", "text", "button"]),
        position: z.object({
          x: z.number(),
          y: z.number(),
          w: z.number(),
          h: z.number(),
        }),
        config: z.record(z.unknown()),
      })
    )
    .default([]),
});

export const appRouter = createTRPCRouter({
  /**
   * List all apps for an organization
   */
  list: orgEditorProcedure.query(async ({ ctx }) => {
    const apps = await ctx.db.app.findMany({
      where: { organizationId: ctx.organization.id },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        isPublished: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            pages: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return apps;
  }),

  /**
   * Get a single app by ID
   */
  getById: orgEditorProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const app = await ctx.db.app.findUnique({
        where: { id: input.id },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
          pages: {
            select: {
              id: true,
              name: true,
              slug: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { name: "asc" },
          },
        },
      });

      if (!app) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "App not found",
        });
      }

      if (app.organizationId !== ctx.organization.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "App not found",
        });
      }

      return app;
    }),

  /**
   * Get an app by slug
   */
  getBySlug: orgEditorProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const app = await ctx.db.app.findFirst({
        where: {
          slug: input.slug,
          organizationId: ctx.organization.id,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
          pages: {
            select: {
              id: true,
              name: true,
              slug: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { name: "asc" },
          },
        },
      });

      if (!app) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "App not found",
        });
      }

      return app;
    }),

  /**
   * Create a new app
   */
  create: orgAdminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const slug = generateSlug(input.name);

      // Check for duplicate slug
      const existing = await ctx.db.app.findFirst({
        where: {
          organizationId: ctx.organization.id,
          slug,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An app with this name already exists",
        });
      }

      const app = await ctx.db.app.create({
        data: {
          name: input.name,
          slug,
          description: input.description,
          isPublished: false,
          config: {},
          organizationId: ctx.organization.id,
          createdById: ctx.session.user.id,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          isPublished: true,
          createdAt: true,
        },
      });

      return app;
    }),

  /**
   * Update an app
   */
  update: orgAdminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional().nullable(),
        isPublished: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const app = await ctx.db.app.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          name: true,
          slug: true,
          organizationId: true,
        },
      });

      if (!app) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "App not found",
        });
      }

      if (app.organizationId !== ctx.organization.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "App not found",
        });
      }

      // If name is being updated, generate new slug and check for duplicates
      let newSlug: string | undefined;
      if (input.name && input.name !== app.name) {
        newSlug = generateSlug(input.name);

        const existing = await ctx.db.app.findFirst({
          where: {
            organizationId: ctx.organization.id,
            slug: newSlug,
            id: { not: input.id },
          },
        });

        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "An app with this name already exists",
          });
        }
      }

      const updated = await ctx.db.app.update({
        where: { id: input.id },
        data: {
          ...(input.name && { name: input.name, slug: newSlug }),
          ...(input.description !== undefined && {
            description: input.description,
          }),
          ...(input.isPublished !== undefined && {
            isPublished: input.isPublished,
          }),
        },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          isPublished: true,
          updatedAt: true,
        },
      });

      return updated;
    }),

  /**
   * Delete an app
   */
  delete: orgAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const app = await ctx.db.app.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          organizationId: true,
        },
      });

      if (!app) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "App not found",
        });
      }

      if (app.organizationId !== ctx.organization.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "App not found",
        });
      }

      await ctx.db.app.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  // ===================
  // PAGE OPERATIONS
  // ===================

  /**
   * Create a new page in an app
   */
  createPage: orgAdminProcedure
    .input(
      z.object({
        appId: z.string(),
        name: z.string().min(1).max(100),
        config: pageConfigSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify app exists and belongs to org
      const app = await ctx.db.app.findUnique({
        where: { id: input.appId },
        select: { id: true, organizationId: true },
      });

      if (!app) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "App not found",
        });
      }

      if (app.organizationId !== ctx.organization.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "App not found",
        });
      }

      const slug = generateSlug(input.name);

      // Check for duplicate slug within app
      const existing = await ctx.db.page.findFirst({
        where: {
          appId: input.appId,
          slug,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A page with this name already exists in this app",
        });
      }

      const page = await ctx.db.page.create({
        data: {
          name: input.name,
          slug,
          config: (input.config ?? {
            layout: { columns: 12 },
            components: [],
          }) as Prisma.InputJsonValue,
          appId: input.appId,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          config: true,
          createdAt: true,
        },
      });

      return page;
    }),

  /**
   * Get a page by ID
   */
  getPage: orgEditorProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const page = await ctx.db.page.findUnique({
        where: { id: input.id },
        include: {
          app: {
            select: {
              id: true,
              name: true,
              slug: true,
              organizationId: true,
            },
          },
        },
      });

      if (!page) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Page not found",
        });
      }

      if (page.app.organizationId !== ctx.organization.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Page not found",
        });
      }

      return page;
    }),

  /**
   * Update a page
   */
  updatePage: orgAdminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        config: pageConfigSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const page = await ctx.db.page.findUnique({
        where: { id: input.id },
        include: {
          app: {
            select: {
              id: true,
              organizationId: true,
            },
          },
        },
      });

      if (!page) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Page not found",
        });
      }

      if (page.app.organizationId !== ctx.organization.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Page not found",
        });
      }

      // If name is being updated, generate new slug and check for duplicates
      let newSlug: string | undefined;
      if (input.name && input.name !== page.name) {
        newSlug = generateSlug(input.name);

        const existing = await ctx.db.page.findFirst({
          where: {
            appId: page.appId,
            slug: newSlug,
            id: { not: input.id },
          },
        });

        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A page with this name already exists in this app",
          });
        }
      }

      const updated = await ctx.db.page.update({
        where: { id: input.id },
        data: {
          ...(input.name && { name: input.name, slug: newSlug }),
          ...(input.config && {
            config: input.config as Prisma.InputJsonValue,
          }),
        },
        select: {
          id: true,
          name: true,
          slug: true,
          config: true,
          updatedAt: true,
        },
      });

      return updated;
    }),

  /**
   * Delete a page
   */
  deletePage: orgAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const page = await ctx.db.page.findUnique({
        where: { id: input.id },
        include: {
          app: {
            select: {
              organizationId: true,
            },
          },
        },
      });

      if (!page) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Page not found",
        });
      }

      if (page.app.organizationId !== ctx.organization.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Page not found",
        });
      }

      await ctx.db.page.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});
