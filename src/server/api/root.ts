import { appRouter as appCrudRouter } from "~/server/api/routers/app";
import { auditRouter } from "~/server/api/routers/audit";
import { dataSourceRouter } from "~/server/api/routers/dataSource";
import { organizationRouter } from "~/server/api/routers/organization";
import { resourceRouter } from "~/server/api/routers/resource";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  app: appCrudRouter,
  audit: auditRouter,
  dataSource: dataSourceRouter,
  organization: organizationRouter,
  resource: resourceRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
