# Contributing

Thanks for helping out! This guide covers how to get set up and what we expect in a pull request.

## Setup

Follow [Local development](README.md#local-development) in the README.

## Workflow

1. Branch from `main`: `feat/<short-name>`, `fix/<short-name>`, `chore/<short-name>`, `docs/<short-name>`.
2. Keep pull requests small and focused on one change.
3. Run `make check` before opening a pull request — it runs backend tests and the frontend lint, typecheck and build.
4. Use [Conventional Commits](https://www.conventionalcommits.org/): `feat: add tag filter to posts list`, `fix(backend): ...`.

## Conventions

Read [docs/architecture.md](docs/architecture.md) first. In short:

**Backend**
- Group code by feature (`post/`, `tag/`, ...), with `controller/ dto/ entity/ repository/ service/` inside.
- DTOs are Java records with Bean Validation annotations; every response uses `ApiResponse`.
- Schema changes go in a **new** Flyway migration (`V{n}__description.sql`); never edit a merged one.
- Never log secrets or personal data.

**Frontend**
- Colors, radii and fonts come from `src/styles/tokens.css` — no raw hex values in components.
- Server-only environment variables never get the `NEXT_PUBLIC_` prefix.
- Next.js 16 differs from older versions; check `frontend/node_modules/next/dist/docs/` when in doubt.

## Reporting bugs and ideas

Open an issue with steps to reproduce, what you expected, and what happened.
For security problems, follow [SECURITY.md](SECURITY.md) instead.
