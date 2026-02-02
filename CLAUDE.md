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

### Phase 1: Foundation (MVP) - In Progress

**Completed:**
- [x] Dependencies installed (pg, @tanstack/react-table, @dnd-kit)
- [x] ENCRYPTION_KEY environment config added
- [x] Encryption service with tests (`src/server/services/encryption.ts`)
- [x] Prisma schema with Organization, DataSource, Resource, App, Page, AuditLog models
- [x] Database created and synced
- [x] Organization middleware utilities (`src/server/api/middleware/organization.ts`)

**In Progress:**
- [ ] Add org procedures to tRPC (orgProcedure, orgEditorProcedure, etc.)
- [ ] Create organization router with tests

**Next:**
- [ ] Install shadcn UI components
- [ ] Create dashboard layout and org switcher
- [ ] Data source connection flow
- [ ] Resource CRUD
