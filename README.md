# Minimal Professional — Interactive Portfolio

A minimalist, accessible, full-stack software engineer portfolio: a public site, a secured admin dashboard, a contact form and a GitHub integration, all backed by a real PostgreSQL database.

## Features

- **Public site:** Home, About, Projects (with detail pages), Tech Stack and Contact. Light and dark theme, subtle motion that respects `prefers-reduced-motion`, SEO metadata, sitemap and generated social preview images.
- **Admin dashboard:** profile, experience, education, technologies, projects with image upload, contact messages and a GitHub import/sync page. Every admin page, action and route re-checks the session on the server.
- **Contact form:** server-side validation, a one-time signed form token, a honeypot, rate limiting and optional Cloudflare Turnstile. New messages are stored and optionally e-mailed through Resend.
- **Security:** strict nonce-based Content-Security-Policy, security headers, Argon2 password hashing, login lockout, same-origin checks on uploads, content-sniffed upload validation.
- **Quality:** TypeScript strict, unit, integration and Playwright end-to-end tests, automated WCAG 2.2 AA checks (axe) in both themes, CI on every push.
- **Maintenance:** a daily Vercel Cron job removes old contact messages, deletes orphaned uploads and refreshes GitHub metadata.

## Stack

Next.js (App Router), React, TypeScript, Tailwind CSS, PostgreSQL with Prisma, Auth.js, Zod, Vercel Blob for production uploads, Vitest, React Testing Library and Playwright. Rationale: [ADR-0001](docs/decisions/0001-tech-stack.md).

## Getting started

Requires Node.js 22.12 or newer and Docker (for the local database).

```bash
npm install
cp .env.example .env.local        # fill in AUTH_SECRET, ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD (12+ characters)
docker compose up -d db           # PostgreSQL on localhost:5433
npm run db:deploy                 # apply migrations
npm run db:seed                   # create the empty profile rows and the first admin
npm run dev                       # http://localhost:3000, admin at /admin
```

The site starts empty: nothing is invented. Fill in your own content through the admin dashboard.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Develop, build and serve |
| `npm run typecheck` / `lint` | Type check and ESLint |
| `npm test` | Unit tests (Vitest) |
| `npm run test:integration` | Integration tests against a disposable `portfolio_test` database |
| `npm run test:e2e` | Builds, then runs Playwright against `next start` with a throwaway `portfolio_e2e` database |
| `npm run db:generate` / `db:migrate` / `db:deploy` / `db:seed` | Prisma client, migrations and the bootstrap seed |

Integration and E2E tests empty their tables, so they refuse to run against any database whose name does not end in `_test` or `_e2e`.

## Deployment

Designed for a free tier: Vercel (hosting and Cron), Neon (PostgreSQL), Vercel Blob (uploads), Resend (notification e-mail) and Cloudflare Turnstile (spam check). Set the variables listed in `.env.example` in the Vercel project (production). Migrations are applied with `npm run db:deploy`. Never commit real values; only `.env.example` is tracked.

## Documentation

- [Architecture](docs/architecture.md)
- [Database schema](docs/database-schema.md)
- [API design](docs/api-design.md)
- [Design system](docs/design-system.md)
- [Roadmap](docs/roadmap.md)
- [Deployment log](docs/m9-log.md)

## License

[MIT](LICENSE)
