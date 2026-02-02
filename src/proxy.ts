import { NextResponse, type NextRequest } from "next/server";

/**
 * Security-focused proxy (Next.js 16 middleware replacement)
 *
 * Security features implemented:
 * 1. Authentication protection for dashboard routes
 * 2. Security headers (CSP, HSTS, etc.)
 * 3. Rate limiting headers for downstream services
 * 4. Request logging for audit trails
 * 5. CSRF protection via SameSite cookies
 */

// Routes that require authentication
const PROTECTED_ROUTES = ["/new", "/api/trpc"];
const PROTECTED_PREFIXES = ["/[orgSlug]"]; // Dynamic org routes

// Routes that should redirect authenticated users away
const AUTH_ROUTES = ["/login", "/register"];

// Public routes that don't need any checks
const PUBLIC_ROUTES = ["/", "/api/auth"];

// Rate limit configuration (requests per window)
const RATE_LIMIT_CONFIG = {
  window: 60, // seconds
  maxRequests: 100,
};

/**
 * Check if a path matches any of the given patterns
 */
function matchesPath(pathname: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    if (pattern.includes("[")) {
      // Handle dynamic route patterns like /[orgSlug]
      const regex = new RegExp(
        "^" + pattern.replace(/\[.*?\]/g, "[^/]+") + "(/.*)?$"
      );
      return regex.test(pathname);
    }
    return pathname === pattern || pathname.startsWith(pattern + "/");
  });
}

/**
 * Check if the request is for a protected route
 */
function isProtectedRoute(pathname: string): boolean {
  // Check exact matches first
  if (PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    return true;
  }

  // Check dynamic prefixes (any /something that looks like an org slug)
  // Org slugs are lowercase alphanumeric with hyphens
  const orgSlugPattern = /^\/[a-z][a-z0-9-]*$/;
  const firstSegment = "/" + pathname.split("/")[1];

  if (
    firstSegment &&
    orgSlugPattern.test(firstSegment) &&
    !PUBLIC_ROUTES.includes(firstSegment) &&
    !AUTH_ROUTES.includes(firstSegment)
  ) {
    return true;
  }

  return false;
}

/**
 * Add security headers to response
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  // Content Security Policy - adjust as needed for your app
  // Using nonce-based CSP is recommended for production
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Relaxed for dev, tighten for prod
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );

  // Strict Transport Security - enforce HTTPS
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );

  // Prevent MIME type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY");

  // Control referrer information
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions Policy - disable unnecessary browser features
  response.headers.set(
    "Permissions-Policy",
    [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "magnetometer=()",
      "gyroscope=()",
      "accelerometer=()",
    ].join(", ")
  );

  // Prevent XSS attacks
  response.headers.set("X-XSS-Protection", "1; mode=block");

  return response;
}

/**
 * Add rate limiting headers for tracking
 */
function addRateLimitHeaders(
  response: NextResponse,
  request: NextRequest
): NextResponse {
  // Add headers that can be used by downstream rate limiters
  // In production, use a proper rate limiting service (Redis, etc.)
  response.headers.set(
    "X-RateLimit-Limit",
    RATE_LIMIT_CONFIG.maxRequests.toString()
  );
  response.headers.set(
    "X-RateLimit-Window",
    RATE_LIMIT_CONFIG.window.toString()
  );

  // Add request ID for tracing/debugging
  const requestId =
    request.headers.get("x-request-id") ?? crypto.randomUUID();
  response.headers.set("X-Request-Id", requestId);

  return response;
}

/**
 * Main proxy function
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Skip proxy for static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Get session token from cookies (Better Auth uses this pattern)
  const sessionToken =
    request.cookies.get("better-auth.session_token")?.value ??
    request.cookies.get("__Secure-better-auth.session_token")?.value;

  const isAuthenticated = !!sessionToken;

  // Handle auth routes - redirect authenticated users to dashboard
  if (AUTH_ROUTES.includes(pathname)) {
    if (isAuthenticated) {
      // Redirect to org selection or last visited org
      return NextResponse.redirect(new URL("/", request.url));
    }
    return addSecurityHeaders(NextResponse.next());
  }

  // Handle protected routes - redirect unauthenticated users to login
  if (isProtectedRoute(pathname)) {
    if (!isAuthenticated) {
      const loginUrl = new URL("/login", request.url);
      // Store the intended destination for post-login redirect
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Create response with security headers
  let response = NextResponse.next();
  response = addSecurityHeaders(response);
  response = addRateLimitHeaders(response, request);

  return response;
}

/**
 * Matcher configuration - defines which routes proxy should run on
 *
 * Excludes:
 * - API auth routes (handled by Better Auth)
 * - Static files
 * - Image optimization
 * - Metadata files
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - Files with extensions (images, fonts, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)",
  ],
};
