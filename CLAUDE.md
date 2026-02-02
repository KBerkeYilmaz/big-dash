# Project Guidelines

## Development Approach

### Test-Driven Development (TDD)
- Write tests BEFORE implementation
- Follow Red-Green-Refactor cycle
- Every function and component should be testable
- Ask about edge cases before implementing
- Run tests after each significant change

### Code Quality
- Components and logic must be human-readable
- Prefer explicit over clever code
- Use descriptive variable and function names
- Keep functions small and focused
- Extract complex logic into testable utilities

### Testing Standards
- Unit tests: Vitest (`pnpm test`)
- E2E tests: Playwright (`pnpm test:e2e`)
- Test file location: `*.test.ts` next to source files, `e2e/` for E2E
- Cover happy path, error cases, and edge cases

## Git Workflow

### Commits
- Meaningful, descriptive commit messages
- Do NOT sign commits as Claude (no Co-Authored-By)
- Commit after each logical unit of work
- Push after commits are verified

### Before Pushing
1. Run type check: `pnpm typecheck`
2. Run linter: `pnpm lint`
3. Run tests: `pnpm test`
4. Fix any issues before pushing

## Package Manager
- Use `pnpm` exclusively (not npm or yarn)
- `pnpm add <package>` for dependencies
- `pnpm add -D <package>` for dev dependencies

## File Structure
- Components: `src/components/`
- API routes: `src/server/api/routers/`
- Types: `src/types/`
- Utilities: `src/lib/`
- Services: `src/server/services/`
- Middleware: `src/server/api/middleware/`
- Tests: alongside source files as `*.test.ts`

## Current Progress

### Phase 1: Foundation (MVP) - Complete ✅

**Completed:**
- [x] Dependencies installed (pg, @tanstack/react-table, @dnd-kit)
- [x] ENCRYPTION_KEY environment config added
- [x] Encryption service with tests (`src/server/services/encryption.ts`)
- [x] Prisma schema with Organization, DataSource, Resource, App, Page, AuditLog models
- [x] Database created and synced
- [x] Organization middleware utilities (`src/server/api/middleware/organization.ts`)
- [x] Org procedures in tRPC (orgProcedure, orgEditorProcedure, orgAdminProcedure, orgOwnerProcedure)
- [x] Organization router with full CRUD + member management
- [x] Data source router with connection testing and encryption
- [x] Resource router with table/query support
- [x] Audit log router
- [x] App router
- [x] shadcn UI components installed
- [x] Dashboard layout with auth protection
- [x] Organization context provider
- [x] Data source connection flow UI
- [x] Resource CRUD UI

### Next.js 16 Migration - Complete ✅

**Completed:**
- [x] Removed `--turbo` from dev script (now default in v16)
- [x] Updated lint scripts to use ESLint directly (`next lint` removed in v16)
- [x] Converted `next.config.js` to `next.config.ts`
- [x] Verified async params/searchParams usage (all correctly using `Promise<>` types)
- [x] Enabled `cacheComponents` for Partial Prerendering
- [x] Enabled `reactCompiler` for automatic memoization
- [x] Added `proxy.ts` with security best practices
- [x] Added Suspense boundaries for cacheComponents compatibility

### Security Features (proxy.ts)

**Implemented:**
- [x] Authentication protection for dashboard routes
- [x] Security headers (CSP, HSTS, X-Frame-Options, etc.)
- [x] Rate limiting headers for downstream services
- [x] Request ID tracking for audit trails
- [x] Permissions Policy to disable unnecessary browser APIs
- [x] Automatic redirect to login with callback URL preservation

### Phase 2: App Builder - Not Started

**Next:**
- [ ] App creation flow
- [ ] Page builder with drag-and-drop
- [ ] Component library (Table, Form, Button, etc.)
- [ ] Data binding to resources
