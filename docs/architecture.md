# Architecture

```
Browser ──► frontend (Next.js) ──► backend (Spring Boot) ──► PostgreSQL
            route handlers proxy     /api/v1/*, /health/*
```

## Principles

- **The browser never talks to the backend directly.** Server components and
  route handlers in `frontend/` call the backend using `BACKEND_API_URL`
  (server-only). The backend therefore needs no CORS config and can stay on
  a private network.
- **One response envelope.** Every backend JSON response is
  `{"data": ..., "meta": ..., "errors": [...]}` (`shared/ApiResponse`).
  Errors carry an `errorCode`, a human `message` and the request's
  `correlationId`.
- **Correlation IDs.** Each request gets an `X-Correlation-ID` (the caller's,
  if well-formed, otherwise generated). It is echoed in the response header,
  included in error bodies and printed on every log line.
- **Schema via migrations only.** Flyway migrations in
  `backend/src/main/resources/db/migration/V{n}__description.sql`;
  Hibernate only validates (`ddl-auto: validate`). Never edit a migration that
  has been merged — add a new one.
- **Tests run against real Postgres** (Testcontainers), not H2, because the
  schema uses Postgres-specific types.

## Backend layout

Code is grouped by feature, then by layer:

```
io.atomity.blogcrm
├── BlogCrmApplication
├── shared/            ApiResponse, ApiError, GlobalExceptionHandler, CorrelationFilter
└── <feature>/         controller/ dto/ entity/ repository/ service/
```

Conventions: constructor injection, Java `record`s for DTOs, UUID primary
keys, timestamps as UTC `Instant` / `TIMESTAMPTZ`, REST paths under
`/api/v1/<plural-resource>`.

## Frontend layout

```
src/
├── app/          Routes only (pages, layouts, route handlers) — each page renders a module canvas
├── modules/      One folder per feature (posts, authors, tags, media, auth):
│                 *Canvas.tsx screens + api.ts, the feature's only data access
├── components/   Shared UI: ui/ (primitives) and shell/ (sidebar, top bar, navigation guard)
├── hooks/        useAsync, useDebouncedValue, useUnsavedChangesWarning
├── lib/          Helpers (slug, content, format) and mock/ (in-browser mock database)
├── styles/       tokens.css (design tokens), base, component classes, editor typography
├── types/        Domain types mirroring the backend's JSON (Post, Author, Tag, Media, Page)
└── proxy.ts      Route gate: no session cookie → /login
```

### Data access and the mock

Screens never fetch directly; they call functions in `modules/<feature>/api.ts`,
each documented with the backend endpoint it maps to. Until the backend exists,
those functions read and write `lib/mock/db.ts` — a normalised copy of the planned
tables kept in `localStorage`, seeded from `lib/mock/seed.ts`. Switching to the
real API replaces the function bodies only; types and screens stay as they are.

Post bodies are Tiptap (ProseMirror) **JSON**, never HTML. Images inside a body
carry `attrs.mediaId`, so the backend can tell which library images a post uses.

## Health

Served by Spring Boot Actuator:

- `GET /health/liveness` — the process is running.
- `GET /health/readiness` — the process is running **and** the database answers.
- `GET /metrics` — Prometheus metrics.
