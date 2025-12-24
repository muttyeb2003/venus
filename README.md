# Acquisitions API

Node.js / Express API using Drizzle ORM and Neon (serverless Postgres).

## Running locally with Docker and Neon Local (development)

This setup runs two services via Docker Compose:

- `app`: the Express API
- `neon-local`: the Neon Local proxy, which connects to Neon Cloud and creates ephemeral branches for development/testing

### 1. Prerequisites

- Docker and Docker Compose installed
- A Neon Cloud project with:
  - API key
  - Project ID
  - Parent branch ID (the branch that Neon Local will clone into ephemeral branches)

### 2. Configure development environment

Create `.env.development` (already scaffolded) and fill in the Neon values:

```env
NEON_API_KEY=your_neon_api_key_here
NEON_PROJECT_ID=your_neon_project_id_here
PARENT_BRANCH_ID=your_parent_branch_id_here
DELETE_BRANCH=true

PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# App connection string pointing to Neon Local inside the compose network
DATABASE_URL=postgres://neon:npg@neon-local:5432/neondb
```

Notes:

- `.env.development` is gitignored (`.env.*` in `.gitignore`).
- `DATABASE_URL` is the **only** value the app uses; Neon Local uses the Neon API key/project/branch details to reach Neon Cloud.
- `DELETE_BRANCH=true` ensures that Neon Local deletes the ephemeral branch when the proxy stops.

### 3. Start Neon Local + app

From the project root:

```bash
docker compose -f docker-compose.dev.yml up --build
```

This will:

- Start `neon-local` on port `5432`.
- Start the app on port `3000`.
- Configure the app to use the Neon serverless driver against Neon Local via `DATABASE_URL`.

Once running, you can access the API at:

- `http://localhost:3000/`
- `http://localhost:3000/health`
- `http://localhost:3000/api/auth/...`

### 4. How Neon Local integration works

- `docker-compose.dev.yml` runs the `neon-local` container using your Neon API key, project ID, and parent branch ID.
- `src/config/database.js` detects non-production (`NODE_ENV !== 'production'`) and:
  - Sets `neonConfig.fetchEndpoint` to `http://neon-local:5432/sql` (or `NEON_LOCAL_FETCH_ENDPOINT` if set).
  - Uses `DATABASE_URL` (defaulting to `postgres://neon:npg@neon-local:5432/neondb`).
- The app then uses the Neon serverless driver + Drizzle ORM against Neon Local, which proxies to an ephemeral Neon branch.

Ephemeral branches are created automatically from `PARENT_BRANCH_ID` and (with `DELETE_BRANCH=true`) cleaned up when `neon-local` stops.

## Running in production with Neon Cloud

In production, you **do not** run Neon Local. Instead, the app connects directly to Neon Cloud using the `DATABASE_URL` provided by Neon.

### 1. Configure production environment

Create `.env.production` (already scaffolded) and set:

```env
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# Copy this from your Neon dashboard
DATABASE_URL=postgres://user:password@your-project-region.neon.tech/dbname
```

In many real deployments, you would store `DATABASE_URL` and other secrets in your platform's secret manager rather than `.env.production`. This file is mainly for local/preview usage.

### 2. Run with docker-compose.prod.yml

For a simple single-node production-style run:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

This will:

- Build the image from `Dockerfile`.
- Run the app container with `NODE_ENV=production`.
- Expose port `3000` (configurable via `PORT`).
- Connect to Neon Cloud using `DATABASE_URL`.

Neon Cloud is an external managed service; it is **not** run as a Docker container. `docker-compose.prod.yml` only runs the application and expects `DATABASE_URL` to point to your Neon Cloud database.

## Environment variable switching (dev vs prod)

- Both environments rely on `process.env.DATABASE_URL` in `src/config/database.js`.
- `NODE_ENV` controls behavior:
  - **Development** (`NODE_ENV=development`):
    - `neonConfig.fetchEndpoint` is set to `http://neon-local:5432/sql`.
    - `DATABASE_URL` should be `postgres://neon:npg@neon-local:5432/neondb`.
  - **Production** (`NODE_ENV=production`):
    - No Neon Local overrides are applied.
    - `DATABASE_URL` must be the Neon Cloud connection string (`...neon.tech...`).

- `docker-compose.dev.yml` loads `.env.development` and uses `DATABASE_URL` pointing to Neon Local.
- `docker-compose.prod.yml` loads `.env.production` and uses `DATABASE_URL` pointing to Neon Cloud.

## Non-Docker local run (optional)

You can still run the app without Docker for quick iteration (using your own `DATABASE_URL`):

```bash
npm install
npm run dev
```

Just ensure `DATABASE_URL` is set appropriately in your local environment (either Neon Local or Neon Cloud).
