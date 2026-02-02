import type { NextConfig } from "next";

/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
 * This is especially useful for Docker builds.
 */
import "./src/env.js";

const nextConfig: NextConfig = {
  // Turbopack is now the default in Next.js 16 - no flags needed

  // Enable Cache Components for Partial Prerendering (PPR)
  // Allows mixing static shells with dynamic content for faster initial loads
  cacheComponents: true,

  // Enable React Compiler for automatic memoization
  // Reduces unnecessary re-renders without manual useMemo/useCallback
  reactCompiler: true,
};

export default nextConfig;
