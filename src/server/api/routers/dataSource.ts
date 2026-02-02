import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Pool } from "pg";

import {
  createTRPCRouter,
  orgEditorProcedure,
  orgAdminProcedure,
} from "~/server/api/trpc";
import { encrypt, decrypt } from "~/server/services/encryption";

/**
 * PostgreSQL connection config schema
 */
const postgresConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  database: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  ssl: z.boolean().optional().default(false),
});

type PostgresConfig = z.infer<typeof postgresConfigSchema>;

/**
 * Test a PostgreSQL connection
 */
async function testPostgresConnection(config: PostgresConfig): Promise<{
  success: boolean;
  error?: string;
  latencyMs?: number;
}> {
  const startTime = Date.now();
  const pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
    query_timeout: 5000,
  });

  try {
    await pool.query("SELECT NOW()");
    const latencyMs = Date.now() - startTime;
    return { success: true, latencyMs };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error };
  } finally {
    await pool.end();
  }
}

export const dataSourceRouter = createTRPCRouter({
  /**
   * List all data sources for an organization
   */
  list: orgEditorProcedure.query(async ({ ctx }) => {
    const dataSources = await ctx.db.dataSource.findMany({
      where: { organizationId: ctx.organization.id },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        lastTestedAt: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return dataSources;
  }),

  /**
   * Get a single data source by ID (without encrypted config)
   */
  getById: orgEditorProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const dataSource = await ctx.db.dataSource.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          lastTestedAt: true,
          createdAt: true,
          updatedAt: true,
          organizationId: true,
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!dataSource) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Data source not found",
        });
      }

      // Verify it belongs to the user's organization
      if (dataSource.organizationId !== ctx.organization.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Data source not found",
        });
      }

      return dataSource;
    }),

  /**
   * Get decrypted config for a data source (admin only)
   */
  getConfig: orgAdminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const dataSource = await ctx.db.dataSource.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          type: true,
          configEncrypted: true,
          organizationId: true,
        },
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

      const decrypted = decrypt(dataSource.configEncrypted);
      const config = JSON.parse(decrypted) as PostgresConfig;

      return {
        type: dataSource.type,
        config,
      };
    }),

  /**
   * Create a new data source
   */
  create: orgAdminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        type: z.enum(["POSTGRESQL"]),
        config: postgresConfigSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check for duplicate name
      const existing = await ctx.db.dataSource.findFirst({
        where: {
          organizationId: ctx.organization.id,
          name: input.name,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A data source with this name already exists",
        });
      }

      // Encrypt the configuration
      const configEncrypted = encrypt(JSON.stringify(input.config));

      const dataSource = await ctx.db.dataSource.create({
        data: {
          name: input.name,
          type: input.type,
          configEncrypted,
          status: "PENDING",
          organizationId: ctx.organization.id,
          createdById: ctx.session.user.id,
        },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          createdAt: true,
        },
      });

      return dataSource;
    }),

  /**
   * Update a data source
   */
  update: orgAdminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        config: postgresConfigSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const dataSource = await ctx.db.dataSource.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          name: true,
          organizationId: true,
        },
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

      // Check for duplicate name if name is being updated
      if (input.name && input.name !== dataSource.name) {
        const existing = await ctx.db.dataSource.findFirst({
          where: {
            organizationId: ctx.organization.id,
            name: input.name,
            id: { not: input.id },
          },
        });

        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A data source with this name already exists",
          });
        }
      }

      // Prepare update data
      const updateData: {
        name?: string;
        configEncrypted?: string;
        status?: "PENDING" | "CONNECTED" | "FAILED";
      } = {};

      if (input.name) {
        updateData.name = input.name;
      }

      if (input.config) {
        updateData.configEncrypted = encrypt(JSON.stringify(input.config));
        updateData.status = "PENDING"; // Reset status when credentials change
      }

      const updated = await ctx.db.dataSource.update({
        where: { id: input.id },
        data: updateData,
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          updatedAt: true,
        },
      });

      return updated;
    }),

  /**
   * Delete a data source
   */
  delete: orgAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const dataSource = await ctx.db.dataSource.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          organizationId: true,
        },
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

      await ctx.db.dataSource.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  /**
   * Test the connection to a data source
   */
  testConnection: orgAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const dataSource = await ctx.db.dataSource.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          type: true,
          configEncrypted: true,
          organizationId: true,
        },
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

      // Decrypt the configuration
      const decrypted = decrypt(dataSource.configEncrypted);
      const config = JSON.parse(decrypted) as PostgresConfig;

      // Test the connection based on type
      let result: { success: boolean; error?: string; latencyMs?: number };

      if (dataSource.type === "POSTGRESQL") {
        result = await testPostgresConnection(config);
      } else {
        result = { success: false, error: "Unsupported database type" };
      }

      // Update the status and lastTestedAt
      await ctx.db.dataSource.update({
        where: { id: input.id },
        data: {
          status: result.success ? "CONNECTED" : "FAILED",
          lastTestedAt: new Date(),
        },
      });

      return result;
    }),

  /**
   * Test a connection without saving (for preview)
   */
  testConnectionPreview: orgAdminProcedure
    .input(
      z.object({
        type: z.enum(["POSTGRESQL"]),
        config: postgresConfigSchema,
      })
    )
    .mutation(async ({ input }) => {
      if (input.type === "POSTGRESQL") {
        return testPostgresConnection(input.config);
      }

      return { success: false, error: "Unsupported database type" };
    }),
});
