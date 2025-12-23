# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Commands

- Install dependencies:
  - `npm install`
- Run the development server (Express API with file watching):
  - `npm run dev` (runs `node --watch src/index.js`)
- Lint the codebase:
  - `npm run lint`
- Lint and auto-fix issues:
  - `npm run lint:fix`
- Format the code with Prettier:
  - `npm run format`
- Check formatting without modifying files:
  - `npm run format:check`
- Database (Drizzle ORM + Neon):
  - Generate migrations from the current schema (`src/models/*.js`): `npm run db:generate`
  - Apply pending migrations to the database: `npm run db:migrate`
  - Open Drizzle Studio (database browser): `npm run db:studio`

### Tests

- There is currently no test runner or `test` script defined in `package.json`, and no `tests/` directory in this repo.
- If you add tests in the future, place them under `tests/**/*.js` to match the ESLint Jest-style globals configuration.

## Architecture overview

### Runtime and entrypoints

- This is an ES module Node.js service (`"type": "module"` in `package.json`).
- Main startup flow:
  - `src/index.js` loads environment variables via `dotenv/config` and imports `./server.js`.
  - `src/server.js` imports the Express app from `src/app.js`, reads `PORT` from the environment (default `3000`), and starts the HTTP server.
  - `src/app.js` constructs and configures the Express application, then is exported as the main app instance.

### HTTP API layer

- `src/app.js` is the central HTTP composition point:
  - Global middleware:
    - `helmet()` for security headers.
    - `cors()` for CORS handling.
    - `express.json()` and `express.urlencoded({ extended: true })` for body parsing.
    - `cookie-parser` for cookie parsing.
    - `morgan('combined')` wired to the Winston logger for structured request logging.
  - Health and basic routes:
    - `GET /` logs a message and returns a simple text response.
    - `GET /health` returns JSON with `status`, `timestamp`, and process `uptime`.
    - `GET /api` returns a basic JSON status payload.
  - Feature routes:
    - `app.use('/api/auth', authRoutes)` mounts authentication-related routes from `src/routes/auth.route.js`.

- `src/routes/auth.route.js` defines authentication endpoints:
  - `POST /api/auth/sign-up` → `signup` controller.
  - `POST /api/auth/sign-in` and `POST /api/auth/sign-out` currently return placeholder responses.

### Configuration and logging

- Config files live in `src/config` and are imported via ESM `imports` aliases defined in `package.json`.
- `src/config/logger.js`:
  - Creates a Winston logger (`logger`) used across the app.
  - Logs are written to files under the `logs/` directory:
    - Errors: `logs/error.lg`.
    - Combined logs: `logs/combined.log`.
  - In non-production (`NODE_ENV !== 'production'`), logs are also output to the console with colors and a simple format.
- `src/config/database.js`:
  - Uses `@neondatabase/serverless` (`neon`) and `drizzle-orm/neon-http` to construct a database client.
  - Exports `db` (Drizzle client) and `sql` (raw Neon client), using `process.env.DATABASE_URL`.
- `drizzle.config.js`:
  - Points Drizzle to `./src/models/*.js` for schema definitions and outputs generated artifacts into `./drizzle`.
  - Uses the `postgresql` dialect with `DATABASE_URL` from the environment.

### Database and models

- Database schema is defined with Drizzle ORM in `src/models`:
  - `src/models/user.model.js` defines the `users` table with fields:
    - `id` (primary key, serial), `name`, `email` (unique), `password`, `role` (defaults to `'user'`), `created_at`, and `updated_at` timestamps.
- This schema is the source of truth for generating and running migrations via Drizzle (`npm run db:generate` / `npm run db:migrate`).

### Auth flow and domain logic

- Validation (`src/validations/auth.validation.js`):
  - Uses `zod` to validate request bodies.
  - `signupSchema` ensures:
    - `name` is a trimmed string between 2 and 255 characters.
    - `email` is a valid email, lowercased and trimmed, up to 255 characters.
    - `password` is a string between 6 and 128 characters.
    - `role` is either `'user'` or `'admin'` (default `'user'`).
  - `signInSchema` exists but is not yet wired into any route.

- Controller (`src/controllers/auth.controller.js`):
  - `signup(req, res, next)` is the main implemented endpoint:
    - Validates `req.body` with `signupSchema.safeParse`.
    - On validation failure, returns HTTP 400 with a formatted error payload.
    - On success, calls the auth service `createUser` with the validated data.
    - On success, issues a JWT for the user and sets it as a cookie before responding with basic user info.
    - Logs registration events and errors using the shared `logger`.

- Service (`src/services/auth.service.js`):
  - `hashPassword(password)` uses `bcrypt.hash` with a cost factor of 10 and logs/throws on failure.
  - `createUser({ name, email, password, role })`:
    - Checks for an existing user by email using `db.select().from(users).where(eq(users.email, email))`.
    - Throws if a user already exists.
    - Hashes the password and inserts a new user row into `users`.
    - Returns a subset of user fields (id, name, email, role, created_at) and logs success.

- Utilities:
  - `src/utils/jwt.js`:
    - Wraps `jsonwebtoken` in a `jwttoken` helper with `sign` and `verify` methods.
    - Uses `JWT_SECRET` from `process.env.JWT_SECRET` (or a fallback string) and `JWT_EXPIRES_IN = '1d'`.
    - Logs and throws on token signing or verification errors.
  - `src/utils/cookies.js`:
    - Centralizes cookie configuration (httpOnly, secure in production, `sameSite: 'strict'`, 15-minute `maxAge`).
    - Provides `set`, `clear`, and `get` helpers for working with cookies on the response/request.
  - `src/utils/format.js`:
    - `formatValidationError` converts Zod validation errors into a readable comma-separated string.

### Module resolution and aliases

- `package.json` defines ESM `imports` aliases for cleaner imports:
  - `#config/*` → `./src/config/*`
  - `#controllers/*` → `./src/controllers/*`
  - `#middleware/*` → `./src/middleware/*` (directory may not yet exist)
  - `#models/*` → `./src/models/*`
  - `#routes/*` → `./src/routes/*`
  - `#servies/*` → `./src/servies/*` (note the spelling; use with care or correct if the directory is added)
  - `#utils/*` → `./src/utils/*`
  - `#validations/*` → `./src/validations/*`
- When adding new modules under these directories, prefer these aliases for consistency.

## Tooling and conventions

- ESLint (`eslint.config.js`):
  - Extends `@eslint/js` recommended config.
  - Key rules: 2-space indentation, Unix line endings, single quotes, semicolons required, `prefer-const`, `no-var`, `object-shorthand`, and `prefer-arrow-callback`.
  - `no-console` is disabled but most logging should still go through the shared `logger` where appropriate.
  - ESLint is configured to recognize Jest-style globals (`describe`, `it`, `expect`, etc.) under `tests/**/*.js` for future tests.
  - Ignores `node_modules/**`, `coverage/**`, `logs/**`, and `drizzle/**`.
- Prettier:
  - Configured via `.prettierrc` and `.prettierignore` to enforce consistent formatting (used by the `format` and `format:check` scripts).
- Environment configuration:
  - `.env` / `.env.example` define environment variables for server configuration and database access, including `PORT`, `NODE_ENV`, `LOG_LEVEL`, and `DATABASE_URL`.
  - `dotenv/config` is imported at the entrypoint so environment variables are available throughout the app.
- Generated and runtime artifacts:
  - Drizzle migrations and metadata are written into the `drizzle/` directory.
  - Application and error logs are written into the `logs/` directory, which is excluded from linting.
