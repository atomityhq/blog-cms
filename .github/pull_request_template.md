<!--
Title: use Conventional Commits, e.g. "feat: tag filter on posts list" or "fix(backend): slug conflict on duplicate".
Keep the PR small and focused on one change. Delete any section that doesn't apply.
-->

## Description

<!-- What does this change, and why? Link the issue it closes. -->

Closes #

## Type of change

- [ ] 🐛 Bug fix
- [ ] ✨ New feature
- [ ] ♻️ Refactor (no behaviour change)
- [ ] 📚 Documentation
- [ ] 🔧 Build, CI or tooling
- [ ] ⚠️ Breaking change (API, database or config changes that need action from users)

## Steps to reproduce / how to test

<!-- How a reviewer can see the change working (and, for a fix, see the bug before it). -->

1.
2.
3.

**Expected result:**

## Screenshots

<!-- For UI changes: before / after. Delete otherwise. -->

## Checklist

**Title**
- [ ] The PR title follows `type: short summary` (`feat`, `fix`, `docs`, `chore`, `refactor`, …)

**Tests**
- [ ] Backend tests pass — `make test` (or the pre-commit hook ran `gradle build`)
- [ ] Frontend lint, type check and build pass — `cd frontend && npm run check`
- [ ] I added or updated tests that cover this change
- [ ] I tested it by hand in the running app (`make up` or `make backend` + `make frontend`)

**Code**
- [ ] The git hooks ran on my commits (no `--no-verify`)
- [ ] Database changes are in a **new** Flyway migration — no merged migration was edited
- [ ] No hard-coded colours in the frontend — design tokens from `src/styles/tokens.css` only
- [ ] No secrets, tokens or personal data in code, logs or fixtures

**Docs & config**
- [ ] New environment variables are added to `.env.example` / `backend/.env.example` / `frontend/.env.example` and the README
- [ ] README / CONTRIBUTING / `docs/architecture.md` updated if behaviour or setup changed
