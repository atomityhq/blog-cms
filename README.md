# blog-crm

An open-source CRM for writing, managing and publishing blog posts.

- **Frontend** — Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Backend** — Spring Boot 3.4, Java 21, Gradle
- **Database** — PostgreSQL 16, schema managed by Flyway

> **Status:** the backend API (posts, authors, tags, media, admin login) is in place, and
> every CRM screen exists in the frontend. The frontend still runs on sample data stored in
> the browser (sign in with any email and password); connecting it to the API only changes
> the `api.ts` files in `frontend/src/modules/*`.

## Repository layout

```
blog-crm/
├── frontend/            Next.js admin UI (own package.json, Dockerfile)
├── backend/             Spring Boot API (own Gradle wrapper, Dockerfile)
├── docs/                Architecture notes
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

Requires **Java 21**, **Node.js ≥ 20.9** and Docker (for Postgres and backend tests).

```bash
make db                                   # start Postgres only
make backend                              # Spring Boot on :8080 (profile: local)

cp frontend/.env.example frontend/.env.local
make install && make frontend             # Next.js on :3000
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
| `SPRING_DATASOURCE_URL`      | backend  | JDBC URL, e.g. `jdbc:postgresql://host:5432/blog_crm` |
| `SPRING_DATASOURCE_USERNAME` | backend  | Database user                                |
| `SPRING_DATASOURCE_PASSWORD` | backend  | Database password                            |
| `ADMIN_EMAIL`                | backend  | Email of the single admin account            |
| `ADMIN_PASSWORD_HASH`        | backend  | bcrypt hash of the admin password (see below) |
| `JWT_SECRET`                 | backend  | Session-token signing key, ≥ 32 characters   |
| `JWT_TTL`                    | backend  | Session length (default `8h`)                |
| `MEDIA_STORAGE_PATH`         | backend  | Directory for uploaded images (default `./data/media`) |
| `SERVER_PORT`                | backend  | HTTP port (default `8080`)                   |
| `BACKEND_API_URL`            | frontend | Backend base URL, used server-side only      |

The admin password is never configured in plain text. Generate its hash with:

```bash
docker run --rm httpd:2.4-alpine htpasswd -nbBC 10 "" 'your-password' | tr -d ':\n'
```

In `.env`, wrap the hash in single quotes — it contains `$`, which Compose would otherwise expand.

See [`backend/.env.example`](backend/.env.example) and [`frontend/.env.example`](frontend/.env.example).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md). Security issues: see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
