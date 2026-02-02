import { z } from "zod";
import type { Prisma } from "@prisma/client";

import { createTRPCRouter, orgAdminProcedure } from "~/server/api/trpc";

export const auditRouter = createTRPCRouter({
  /**
   * List audit logs for an organization
   */
  list: orgAdminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
        entityType: z.string().optional(),
        entityId: z.string().optional(),
        userId: z.string().optional(),
        action: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const logs = await ctx.db.auditLog.findMany({
        where: {
          organizationId: ctx.organization.id,
          ...(input.entityType && { entityType: input.entityType }),
          ...(input.entityId && { entityId: input.entityId }),
          ...(input.userId && { userId: input.userId }),
          ...(input.action && { action: input.action }),
        },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
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

      let nextCursor: string | undefined;
      if (logs.length > input.limit) {
        const nextItem = logs.pop();
        nextCursor = nextItem?.id;
      }

      return {
        logs,
        nextCursor,
      };
    }),

  /**
   * Get a single audit log entry
   */
  getById: orgAdminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const log = await ctx.db.auditLog.findUnique({
        where: { id: input.id },
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

      if (!log || log.organizationId !== ctx.organization.id) {
        return null;
      }

      return log;
    }),
});

/**
 * Helper function to create audit log entries
 * Call this from other routers when making changes
 */
export async function createAuditLog(
  db: typeof import("~/server/db").db,
  params: {
    organizationId: string;
    userId: string;
    action: string;
    entityType: string;
    entityId?: string;
    metadata: Prisma.InputJsonValue;
    ipAddress?: string;
    userAgent?: string;
  }
) {
  return db.auditLog.create({
    data: {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      organizationId: params.organizationId,
      userId: params.userId,
    },
  });
}
