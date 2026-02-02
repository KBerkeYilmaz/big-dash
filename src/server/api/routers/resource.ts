import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";

import {
  createTRPCRouter,
  orgEditorProcedure,
  orgAdminProcedure,
} from "~/server/api/trpc";

/**
 * TABLE resource config - direct CRUD on a database table
 */
const tableConfigSchema = z.object({
  tableName: z.string().min(1),
  columns: z.array(z.string()).min(1),
  primaryKey: z.array(z.string()).default([]),
  // Optional column display settings
  columnConfig: z
    .record(
      z.object({
        label: z.string().optional(),
        hidden: z.boolean().optional(),
        editable: z.boolean().optional(),
      })
    )
    .optional(),
});

/**
 * QUERY resource config - custom SQL query (read-only)
 */
const queryConfigSchema = z.object({
  sql: z.string().min(1),
  parameters: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(["string", "number", "boolean", "date"]),
        defaultValue: z
          .union([z.string(), z.number(), z.boolean(), z.null()])
          .optional(),
      })
    )
    .optional(),
});

/**
 * Validate that SQL doesn't contain dangerous operations
 */
function validateSqlSafety(sql: string): void {
  const upperSql = sql.toUpperCase();
  const dangerousPatterns = [
    /\bDROP\b/,
    /\bTRUNCATE\b/,
    /\bALTER\b/,
    /\bCREATE\b/,
    /\bGRANT\b/,
    /\bREVOKE\b/,
    /\bDELETE\s+FROM\s+\w+\s*$/i, // DELETE without WHERE
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(upperSql)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "SQL contains disallowed operations",
      });
    }
  }
}

export const resourceRouter = createTRPCRouter({
  /**
   * List all resources for an organization
   */
  list: orgEditorProcedure
    .input(
      z.object({
        dataSourceId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const resources = await ctx.db.resource.findMany({
        where: {
          organizationId: ctx.organization.id,
          ...(input.dataSourceId && { dataSourceId: input.dataSourceId }),
        },
        select: {
          id: true,
          name: true,
          type: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          dataSource: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { name: "asc" },
      });

      return resources;
    }),

  /**
   * Get a single resource by ID
   */
  getById: orgEditorProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const resource = await ctx.db.resource.findUnique({
        where: { id: input.id },
        include: {
          dataSource: {
            select: {
              id: true,
              name: true,
              type: true,
              status: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!resource) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource not found",
        });
      }

      if (resource.organizationId !== ctx.organization.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Resource not found",
        });
      }

      return resource;
    }),

  /**
   * Create a TABLE resource
   */
  createTable: orgAdminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        dataSourceId: z.string(),
        config: tableConfigSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify data source exists and belongs to org
      const dataSource = await ctx.db.dataSource.findUnique({
        where: { id: input.dataSourceId },
        select: { id: true, organizationId: true },
      });

      if (!dataSource) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Data source not found",
        });
      }

      if (dataSource.organizationId !== ctx.organization.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Data source not found",
        });
      }

      // Check for duplicate name
      const existing = await ctx.db.resource.findFirst({
        where: {
          organizationId: ctx.organization.id,
          name: input.name,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A resource with this name already exists",
        });
      }

      const resource = await ctx.db.resource.create({
        data: {
          name: input.name,
          description: input.description,
          type: "TABLE",
          config: input.config as Prisma.InputJsonValue,
          organizationId: ctx.organization.id,
          dataSourceId: input.dataSourceId,
          createdById: ctx.session.user.id,
        },
        select: {
          id: true,
          name: true,
          type: true,
          config: true,
          createdAt: true,
        },
      });

      return resource;
    }),

  /**
   * Create a QUERY resource
   */
  createQuery: orgAdminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        dataSourceId: z.string(),
        config: queryConfigSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate SQL safety
      validateSqlSafety(input.config.sql);

      // Verify data source exists and belongs to org
      const dataSource = await ctx.db.dataSource.findUnique({
        where: { id: input.dataSourceId },
        select: { id: true, organizationId: true },
      });

      if (!dataSource) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Data source not found",
        });
      }

      if (dataSource.organizationId !== ctx.organization.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Data source not found",
        });
      }

      // Check for duplicate name
      const existing = await ctx.db.resource.findFirst({
        where: {
          organizationId: ctx.organization.id,
          name: input.name,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A resource with this name already exists",
        });
      }

      const resource = await ctx.db.resource.create({
        data: {
          name: input.name,
          description: input.description,
          type: "QUERY",
          config: input.config as Prisma.InputJsonValue,
          organizationId: ctx.organization.id,
          dataSourceId: input.dataSourceId,
          createdById: ctx.session.user.id,
        },
        select: {
          id: true,
          name: true,
          type: true,
          config: true,
          createdAt: true,
        },
      });

      return resource;
    }),

  /**
   * Update a resource
   */
  update: orgAdminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        config: z.union([tableConfigSchema, queryConfigSchema]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const resource = await ctx.db.resource.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          name: true,
          type: true,
          organizationId: true,
        },
      });

      if (!resource) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource not found",
        });
      }

      if (resource.organizationId !== ctx.organization.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Resource not found",
        });
      }

      // If config is provided and it's a QUERY type, validate SQL
      if (input.config && resource.type === "QUERY" && "sql" in input.config) {
        validateSqlSafety(input.config.sql);
      }

      // Check for duplicate name if name is being updated
      if (input.name && input.name !== resource.name) {
        const existing = await ctx.db.resource.findFirst({
          where: {
            organizationId: ctx.organization.id,
            name: input.name,
            id: { not: input.id },
          },
        });

        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A resource with this name already exists",
          });
        }
      }

      const updated = await ctx.db.resource.update({
        where: { id: input.id },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.config && {
            config: input.config as Prisma.InputJsonValue,
          }),
        },
        select: {
          id: true,
          name: true,
          type: true,
          config: true,
          updatedAt: true,
        },
      });

      return updated;
    }),

  /**
   * Delete a resource
   */
  delete: orgAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const resource = await ctx.db.resource.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          organizationId: true,
        },
      });

      if (!resource) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource not found",
        });
      }

      if (resource.organizationId !== ctx.organization.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Resource not found",
        });
      }

      await ctx.db.resource.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});
