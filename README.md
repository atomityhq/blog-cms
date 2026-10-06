# blog-cms

Open-source CMS for writing, managing and publishing blog posts.

`blog-cms` has two jobs:

1. **Give editors one admin UI** to write posts in a rich-text editor, organise them with
   authors and tags, manage an image library, and move each post through its
   draft → published → archived lifecycle.
2. **Keep content in a single, consistent store**: a Spring Boot API that validates every
   change, enforces the publishing rules and persists everything in PostgreSQL.

- **Frontend** — Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Backend** — Spring Boot 3.4, Java 21, Gradle
- **Database** — PostgreSQL 16, schema managed by Flyway

> **Status:** the CMS works end to end — write, edit and publish posts, manage authors,
> tags and images, all stored in PostgreSQL through the Spring Boot API.

## Design at a glance

```text
           Browser (admin UI)
                  │
                  │  same-origin only: /api/auth/*, /api/v1/*
                  ▼
        frontend (Next.js server)
         ├─ proxy.ts           no session cookie → /login
         ├─ /api/auth/*        login / logout, sets httpOnly session cookie
         └─ /api/v1/[...path]  proxy: cookie → Authorization: Bearer <JWT>
                  │
                  │  BACKEND_API_URL (server-side only, private network)
                  ▼
        backend (Spring Boot)
         ├─ CorrelationFilter  X-Correlation-ID on every request and log line
         ├─ Security           validates the JWT on every call
         ├─ Controllers        /api/v1/{posts,authors,tags,media,auth}
         └─ Services           business rules, slugs, content analysis
                  │
         ┌────────┴─────────┐
         ▼                  ▼
    PostgreSQL         Media storage
   (Flyway schema)    (local disk, MEDIA_STORAGE_PATH)
```

The browser never talks to the backend directly. The backend needs no CORS config, can
stay on a private network, and answers every request with the same envelope:
`{"data": ..., "meta": ..., "errors": [...]}`.

Full details — auth, API, business rules and code layout — are in
[`docs/architecture.md`](docs/architecture.md).

## Workflow design

### Request flow

```text
Screen (*Canvas.tsx)
      │  calls
      ▼
modules/<feature>/api.ts        one function per backend endpoint
      │
      ▼
lib/api-client.ts  ──►  /api/v1/* route handler  ──►  backend /api/v1/*
                              │                            │
                              │ 401 → clear cookie,        │ Controller → Service
                              │ redirect to /login?next=…  │ → Repository → Postgres
                              ▼                            ▼
                        response envelope  ◄──────  ApiResponse / ApiError
```

### Post lifecycle

```text
                 create / duplicate
                         │
                         ▼
   ┌──────────────►   DRAFT   ◄──────────────┐
   │                     │                   │
   │ unpublish           │ publish           │ unpublish (restore)
   │                     │ (needs a title    │
   │                     │  and content)     │
   │                     ▼                   │
   └───────────────  PUBLISHED               │
                         │                   │
                         │ archive           │
                         ▼                   │
                     ARCHIVED  ──────────────┘
```

- A draft can be archived directly too; unpublishing an archived post restores it to draft.
- `publishedAt` is set on first publication and kept across unpublish/republish.
- Every save carries the `version` the editor loaded; a stale one gets
  `409 VERSION_CONFLICT` instead of overwriting someone else's changes.
- On save, the backend derives the post's plain text (for search), word count, reading time
  and the library images it embeds — images in use can't be deleted.

### Contribution workflow

```text
feature branch ──► git commit ──► git push ──► pull request ──► review ──► main
                       │              │
                       ▼              ▼
                  pre-commit      pre-push
                  hygiene,        no direct pushes to main,
                  lint, types,    no .env files, keys or
                  build, tests    conflict markers
                  (staged parts only)
```

Hooks live in [`.githooks/`](.githooks) and are enabled by `make install` (or `make hooks`).
Pre-commit runs only the checks for the parts of the repo you staged — frontend changes get
ESLint, typecheck and a production build; backend changes get the Gradle build with tests
(Docker required for Testcontainers).

## Repository layout

```
blog-cms/
├── frontend/            Next.js admin UI (own package.json, Dockerfile)
├── backend/             Spring Boot API (own Gradle wrapper, Dockerfile)
├── docs/                Architecture notes
├── .githooks/           pre-commit and pre-push checks
├── .github/             Issue and pull request templates
├── docker-compose.yml   Full local stack: postgres + backend + frontend
└── Makefile             Shortcuts for both stacks — run `make help`
```

Each app is self-contained: it builds, tests and ships on its own, with its own toolchain.

## Quick start (Docker)

Requires Docker with Compose v2.

```bash
cp .env.example .env
make up            # or: docker compose up --build
```

| Service  | URL                                       |
|----------|-------------------------------------------|
| Frontend | http://localhost:3000                     |
| Backend  | http://localhost:8080/health/readiness    |
| Postgres | `localhost:5432` (credentials from `.env`) |

With the defaults from `.env.example` you sign in as **admin@example.com / admin** — change
`ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` and `JWT_SECRET` before exposing it anywhere.

## Local development

Requires **Java 21**, **Node.js ≥ 20.9** with **npm ≥ 11.16**, and Docker (for Postgres and backend tests).

```bash
make db                                   # start Postgres only
make backend                              # Spring Boot on :8080 (profile: local)

cp frontend/.env.example frontend/.env.local
make install && make frontend             # Next.js on :3000 (also enables the git hooks)
```

### Useful commands

| Command      | What it does                                                   |
|--------------|----------------------------------------------------------------|
| `make test`  | Backend tests (Testcontainers starts a real Postgres)          |
| `make lint`  | Frontend lint + typecheck                                      |
| `make check` | Everything: backend tests, frontend lint, typecheck and build  |

## Configuration

| Variable                     | App      | Description                                  |
|------------------------------|----------|----------------------------------------------|
| `SPRING_DATASOURCE_URL`      | backend  | JDBC URL, e.g. `jdbc:postgresql://host:5432/blog_cms` |
| `SPRING_DATASOURCE_USERNAME` | backend  | Database user                                |
| `SPRING_DATASOURCE_PASSWORD` | backend  | Database password                            |
| `ADMIN_EMAIL`                | backend  | Email of the single admin account            |
| `ADMIN_PASSWORD_HASH`        | backend  | bcrypt hash of the admin password (see below) |
| `JWT_SECRET`                 | backend  | Session-token signing key, ≥ 32 characters   |
| `JWT_TTL`                    | backend  | Session length (default `8h`)                |
| `MEDIA_STORAGE_PATH`         | backend  | Directory for uploaded images (default `./data/media`) |
| `SERVER_PORT`                | backend  | HTTP port (default `8080`)                   |
| `BACKEND_API_URL`            | frontend | Backend base URL, used server-side only      |
| `SESSION_COOKIE_SECURE`      | frontend | `false` to allow sign-in over plain HTTP on a host other than localhost (default: on in production) |

The admin password is never configured in plain text. Generate its hash with:

```bash
docker run --rm httpd:2.4-alpine htpasswd -nbBC 10 "" 'your-password' | tr -d ':\n'
```

In `.env`, wrap the hash in single quotes — it contains `$`, which Compose would otherwise expand.

See [`backend/.env.example`](backend/.env.example) and [`frontend/.env.example`](frontend/.env.example).

## Contributor entry points

Start with:

- [`docs/architecture.md`](docs/architecture.md) — principles, auth, API, business rules, code layout
- [`CONTRIBUTING.md`](CONTRIBUTING.md)
- [`backend/.env.example`](backend/.env.example) and [`frontend/.env.example`](frontend/.env.example)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md). Security issues: see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
