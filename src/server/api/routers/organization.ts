import { z } from "zod";
import { TRPCError } from "@trpc/server";

import {
  createTRPCRouter,
  protectedProcedure,
  orgProcedure,
  orgAdminProcedure,
  orgOwnerProcedure,
} from "~/server/api/trpc";
import {
  generateSlug,
  validateSlug,
  isSlugAvailable,
} from "./organization.helpers";

export const organizationRouter = createTRPCRouter({
  /**
   * List all organizations the current user is a member of
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.organizationMember.findMany({
      where: { userId: ctx.session.user.id },
      include: {
        organization: true,
      },
      orderBy: { organization: { name: "asc" } },
    });

    return memberships.map((m) => ({
      ...m.organization,
      role: m.role,
    }));
  }),

  /**
   * Get a single organization by slug
   */
  getBySlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUnique({
        where: { slug: input.slug },
        include: {
          _count: {
            select: {
              members: true,
              dataSources: true,
              apps: true,
            },
          },
        },
      });

      if (!org) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      // Verify user is a member
      const membership = await ctx.db.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: org.id,
            userId: ctx.session.user.id,
          },
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not a member of this organization",
        });
      }

      return {
        ...org,
        role: membership.role,
      };
    }),

  /**
   * Create a new organization
   * The creating user becomes the OWNER
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        slug: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Generate slug from name if not provided
      let slug = input.slug ?? generateSlug(input.name);

      // Validate slug format
      if (!validateSlug(slug)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Invalid slug format. Use 3-50 lowercase letters, numbers, and hyphens.",
        });
      }

      // Check slug availability
      if (!(await isSlugAvailable(ctx.db, slug))) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This slug is already taken",
        });
      }

      // Create org and add user as owner in a transaction
      const org = await ctx.db.$transaction(async (tx) => {
        const newOrg = await tx.organization.create({
          data: {
            name: input.name,
            slug,
          },
        });

        await tx.organizationMember.create({
          data: {
            organizationId: newOrg.id,
            userId: ctx.session.user.id,
            role: "OWNER",
          },
        });

        return newOrg;
      });

      return org;
    }),

  /**
   * Update organization details
   * Requires ADMIN or OWNER role
   */
  update: orgAdminProcedure
    .input(
      z.object({
        organizationId: z.string(),
        name: z.string().min(1).max(100).optional(),
        slug: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updates: { name?: string; slug?: string } = {};

      if (input.name) {
        updates.name = input.name;
      }

      if (input.slug) {
        if (!validateSlug(input.slug)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid slug format",
          });
        }

        if (!(await isSlugAvailable(ctx.db, input.slug, input.organizationId))) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This slug is already taken",
          });
        }

        updates.slug = input.slug;
      }

      const org = await ctx.db.organization.update({
        where: { id: input.organizationId },
        data: updates,
      });

      return org;
    }),

  /**
   * Delete an organization
   * Requires OWNER role
   */
  delete: orgOwnerProcedure
    .input(z.object({ organizationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.organization.delete({
        where: { id: input.organizationId },
      });

      return { success: true };
    }),

  /**
   * List members of an organization
   */
  listMembers: orgProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const members = await ctx.db.organizationMember.findMany({
        where: { organizationId: input.organizationId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      });

      return members;
    }),

  /**
   * Update a member's role
   * Requires OWNER role
   * Cannot change your own role or demote the last owner
   */
  updateMemberRole: orgOwnerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        userId: z.string(),
        role: z.enum(["OWNER", "ADMIN", "EDITOR", "VIEWER"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Cannot change your own role
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot change your own role",
        });
      }

      // If demoting an owner, ensure there's at least one other owner
      const targetMember = await ctx.db.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: input.organizationId,
            userId: input.userId,
          },
        },
      });

      if (!targetMember) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Member not found",
        });
      }

      if (targetMember.role === "OWNER" && input.role !== "OWNER") {
        const ownerCount = await ctx.db.organizationMember.count({
          where: {
            organizationId: input.organizationId,
            role: "OWNER",
          },
        });

        if (ownerCount <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot demote the last owner",
          });
        }
      }

      const updated = await ctx.db.organizationMember.update({
        where: {
          organizationId_userId: {
            organizationId: input.organizationId,
            userId: input.userId,
          },
        },
        data: { role: input.role },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return updated;
    }),

  /**
   * Remove a member from the organization
   * Requires ADMIN role (or OWNER)
   * Cannot remove yourself or the last owner
   */
  removeMember: orgAdminProcedure
    .input(
      z.object({
        organizationId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Cannot remove yourself
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot remove yourself. Leave the organization instead.",
        });
      }

      const targetMember = await ctx.db.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: input.organizationId,
            userId: input.userId,
          },
        },
      });

      if (!targetMember) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Member not found",
        });
      }

      // Only owners can remove other owners
      if (targetMember.role === "OWNER" && ctx.memberRole !== "OWNER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only owners can remove other owners",
        });
      }

      // Cannot remove the last owner
      if (targetMember.role === "OWNER") {
        const ownerCount = await ctx.db.organizationMember.count({
          where: {
            organizationId: input.organizationId,
            role: "OWNER",
          },
        });

        if (ownerCount <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot remove the last owner",
          });
        }
      }

      await ctx.db.organizationMember.delete({
        where: {
          organizationId_userId: {
            organizationId: input.organizationId,
            userId: input.userId,
          },
        },
      });

      return { success: true };
    }),

  /**
   * Leave an organization
   * Cannot leave if you're the last owner
   */
  leave: orgProcedure
    .input(z.object({ organizationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check if user is the last owner
      if (ctx.memberRole === "OWNER") {
        const ownerCount = await ctx.db.organizationMember.count({
          where: {
            organizationId: input.organizationId,
            role: "OWNER",
          },
        });

        if (ownerCount <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Cannot leave as the last owner. Transfer ownership or delete the organization.",
          });
        }
      }

      await ctx.db.organizationMember.delete({
        where: {
          organizationId_userId: {
            organizationId: input.organizationId,
            userId: ctx.session.user.id,
          },
        },
      });

      return { success: true };
    }),
});
