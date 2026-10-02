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
├── app/          Routes only (pages, layouts, route handlers)
├── modules/      One folder per feature: page.tsx, canvas.tsx (client), api.ts
├── components/   Shared UI
├── lib/          Server and shared helpers (backend client, utils)
├── styles/       Design tokens (tokens.css) — components never use raw hex
└── types/        Shared TypeScript types
```

## Health

Served by Spring Boot Actuator:

- `GET /health/liveness` — the process is running.
- `GET /health/readiness` — the process is running **and** the database answers.
- `GET /metrics` — Prometheus metrics.
