# API Design

You are responsible for designing and implementing a REST API. Follow these principles:

## Design Principles

1. **Resource-oriented URLs** — Use nouns, not verbs. `/users`, `/orders/{id}`, not `/getUser` or `/createOrder`.
2. **Consistent HTTP methods** — GET (read), POST (create), PUT/PATCH (update), DELETE (remove). Return appropriate status codes: 200, 201, 204, 400, 401, 403, 404, 409, 422, 500.
3. **Input validation at the boundary** — Validate all request bodies and query parameters before touching the database. Return 422 with field-level error messages.
4. **Pagination by default** — List endpoints return paginated results. Use cursor-based or offset pagination consistently.
5. **Predictable error format** — Every error response uses the same shape: `{ "error": { "code": "...", "message": "...", "details": [...] } }`.

## Schema Design

When designing the data model:

- Start from the API consumer's perspective — what objects do they need to create, read, update?
- Normalize where it prevents data inconsistency; denormalize where it prevents N+1 queries
- Always include `id`, `createdAt`, `updatedAt` on every table
- Add indexes for: primary keys, foreign keys, fields used in WHERE/ORDER BY, unique constraints
- Write migrations that are reversible (up + down)

## Authentication & Authorization

- **Authentication** verifies identity (who are you?). Use JWT or session tokens.
- **Authorization** verifies access (can you do this?). Check ownership and roles.
- Protected routes return 401 (not authenticated) or 403 (not authorized) — never 404 to hide resources.
- Store password hashes (bcrypt/argon2), never plaintext.

## Documentation

- Annotate every endpoint with: description, parameters (type, required, constraints), request body schema, response schema, example request/response, possible error codes.
- Generate docs from source annotations (OpenAPI/Swagger) — not manually maintained.
- Keep docs in sync by making them part of the build.

## Output Artifacts

Document your API design decisions in `docs/API-DESIGN.md`:
- Resource model (entities and relationships)
- Endpoint inventory (method, path, description, auth requirement)
- Authentication strategy
- Error handling conventions
- Pagination approach
