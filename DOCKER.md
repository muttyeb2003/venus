# Docker Setup

This document describes the Docker-based setup for the Acquisitions API, including development with **Neon Local** and production-like deployment with **Neon Cloud**.

---

## 1. Components & Files

### 1.1 Dockerfile

```dockerfile
# Use a lightweight Node image
FROM node:22-alpine

# Create app directory
WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci

# Copy the rest of the source
COPY . .

# Default environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Default command (can be overridden in docker-compose)
CMD ["node", "src/index.js"]
```

Key points:

- Uses a small base image (`node:22-alpine`).
- Installs Node dependencies via `npm ci` for reproducible builds.
- Exposes port `3000` by default; can be overridden with env vars.
- Same image is used for both dev and prod; behavior depends on `NODE_ENV` and `DATABASE_URL`.

### 1.2 .dockerignore

```dockerfile
node_modules
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

logs
coverage
dribble

# Environment files
.env
.env.*

# Docker artifacts
Dockerfile*
docker-compose*.yml

# IDE/editor files
.vscode
.idea
*.swp
*.swo
```

Purpose:

- Keeps build context small (faster builds, smaller images).
- Prevents `.env*` files from being copied into images.
- Skips local artifacts like `node_modules`, logs, coverage, and IDE files.

> Tip: you may want to change `dribble` to `drizzle` if you want to ignore the generated `drizzle/` directory.

### 1.3 docker-compose.dev.yml (Development with Neon Local)

```yaml
over
version: '3.9'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: acquisitions-app-dev
    env_file:
      - .env.development
    environment:
      NODE_ENV: development
      # DATABASE_URL should point at Neon Local inside the compose network.
      DATABASE_URL: ${DATABASE_URL}
    depends_on:
      - neon-local
    ports:
      - "3000:3000"

  neon-local:
    image: neondatabase/neon_local:latest
    container_name: neon-local
    # All Neon-related secrets stay in .env.development (gitignored)
    env_file:
      - .env.development
    environment:
      NEON_API_KEY: ${NEON_API_KEY}
      NEON_PROJECT_ID: ${NEON_PROJECT_ID}
      PARENT_BRANCH_ID: ${PARENT_BRANCH_ID}
      # Optional: set to true to delete ephemeral branches when the proxy stops
      DELETE_BRANCH: ${DELETE_BRANCH:-true}
    ports:
      - "5432:5432"
```

Services:

- **app**
  - Builds from the root `Dockerfile`.
  - Loads configuration from `.env.development`.
  - Sets `NODE_ENV=development`.
  - Uses `DATABASE_URL` pointing to Neon Local.
  - Exposes the API at `http://localhost:3000`.

- **neon-local**
  - Runs `neondatabase/neon_local:latest`.
  - Connects to Neon Cloud using `NEON_API_KEY`, `NEON_PROJECT_ID`, and `PARENT_BRANCH_ID`.
  - Creates and manages **ephemeral branches** for development/testing.

### 1.4 docker-compose.prod.yml (Production-like with Neon Cloud)

```yaml
version: '3.9'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: acquisitions-app-prod
    env_file:
      - .env.production
    environment:
      NODE_ENV: ${NODE_ENV:-production}
      PORT: ${PORT:-3000}
      # In production, DATABASE_URL must be the Neon Cloud connection string
      DATABASE_URL: ${DATABASE_URL}
    ports:
      - "${PORT:-3000}:${PORT:-3000}"

# Note: The Neon Cloud database is not run as a container here.
# The app connects to Neon via the DATABASE_URL provided in .env.production
# or by your deployment platform's secret management.
```

Notes:

- Only the app container runs; there is **no Neon Local** in this stack.
- `DATABASE_URL` must point to your Neon Cloud instance (`...neon.tech...`).
- Use this for local prod-like runs or as a template for real deployments.

### 1.5 Environment files

Both files are created in the repo root and are gitignored (`.env.*` in `.gitignore`).

#### .env.development

```env
# Server configuration (development)
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# Neon Cloud credentials used by Neon Local to create ephemeral branches
# Do NOT commit this file; it is already covered by .gitignore (.env.*)
NEON_API_KEY=your_neon_api_key_here
NEON_PROJECT_ID=your_neon_project_id_here
# Parent branch ID from which Neon Local will create ephemeral branches
PARENT_BRANCH_ID=your_parent_branch_id_here
# Whether Neon Local should delete branches when the proxy stops
DELETE_BRANCH=true

# Connection string used by the app inside the docker-compose.dev network.
# This points to the Neon Local proxy container.
DATABASE_URL=postgres://neon:npg@neon-local:5432/neondb

# Optional override for the Neon serverless fetch endpoint.
# By default, src/config/database.js uses http://neon-local:5432/sql
# NEON_LOCAL_FETCH_ENDPOINT=http://neon-local:5432/sql
```

#### .env.production

```env
# Server configuration (production)
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# Neon Cloud connection string (from Neon dashboard)
# Example value – replace with your real DATABASE_URL from Neon:
# postgres://user:password@your-project-region.neon.tech/dbname
DATABASE_URL=postgres://user:password@your-project-region.neon.tech/dbname
```

---

## 2. Database Configuration (Neon Local vs Neon Cloud)

The app chooses its database configuration via `src/config/database.js`:

```js
import 'dotenv/config';

import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

// When running against Neon Local (development), we point the serverless driver at the
// Neon Local proxy running inside Docker. In production, we rely on the hosted Neon
// endpoint in DATABASE_URL and skip this override.
if (process.env.NODE_ENV !== 'production') {
  neonConfig.fetchEndpoint =
    process.env.NEON_LOCAL_FETCH_ENDPOINT || 'http://neon-local:5432/sql';
  neonConfig.useSecureWebSocket = false;
  neonConfig.poolQueryViaFetch = true;
}

const connectionString =
  process.env.NODE_ENV === 'production'
    ? process.env.DATABASE_URL
    : process.env.DATABASE_URL || 'postgres://neon:npg@neon-local:5432/neondb';

const sql = neon(connectionString);

const db = drizzle(sql);

export { db, sql };
```

Behavior:

- **Development (`NODE_ENV !== 'production`)**
  - Overrides `neonConfig.fetchEndpoint` to point to Neon Local (`http://neon-local:5432/sql`).
  - Uses `DATABASE_URL` from the environment (defaulting to Neon Local Postgres URL).
  - All queries go to Neon Local, which proxies to an ephemeral Neon Cloud branch.

- **Production (`NODE_ENV === 'production`)**
  - Does **not** override Neon config for Neon Local.
  - Uses `DATABASE_URL` exactly as provided (Neon Cloud URL from your dashboard).

---

## 3. Development Workflow (Neon Local)

### 3.1 Prerequisites

- Docker and Docker Compose installed.
- Neon Cloud project with:
  - API key (`NEON_API_KEY`)
  - Project ID (`NEON_PROJECT_ID`)
  - Parent branch ID (`PARENT_BRANCH_ID`) used as the base for ephemeral branches.

### 3.2 Configure .env.development

Fill in the real values:

```env
NEON_API_KEY=...
NEON_PROJECT_ID=...
PARENT_BRANCH_ID=...
DELETE_BRANCH=true

PORT=3000
NODE_ENV=development
LOG_LEVEL=info
DATABASE_URL=postgres://neon:npg@neon-local:5432/neondb
```

Notes:

- `.env.development` is gitignored; never commit your Neon secrets.
- `DATABASE_URL` is the only connection string the app needs; Neon Local uses the API key and project metadata to talk to Neon Cloud.

### 3.3 Start dev stack

From the project root:

```bash
docker compose -f docker-compose.dev.yml up --build
```

This will:

- Start `neon-local` on port `5432`, connected to Neon Cloud.
- Start the app on port `3000`, pointing at Neon Local via `DATABASE_URL`.

Once running, you can reach:

- `http://localhost:3000/`
- `http://localhost:3000/health`
- `http://localhost:3000/api/auth/...`

### 3.4 Stop dev stack

```bash
docker compose -f docker-compose.dev.yml down
```

With `DELETE_BRANCH=true`, Neon Local will delete the ephemeral Neon branch when the proxy stops.

---

## 4. Production-like Workflow (Neon Cloud Only)

### 4.1 Configure .env.production

Set production values:

```env
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# Copy this from your Neon dashboard
DATABASE_URL=postgres://user:password@your-project-region.neon.tech/dbname
```

In a real deployment, these values (especially `DATABASE_URL`) would typically be managed by your platform's secret manager, not committed in a file.

### 4.2 Run with docker-compose.prod.yml

From the project root:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

This will:

- Build the image from `Dockerfile`.
- Start the app container with `NODE_ENV=production`.
- Bind `${PORT}` (default `3000`) on the host.
- Connect directly to Neon Cloud via `DATABASE_URL`.

To stop:

```bash
docker compose -f docker-compose.prod.yml down
```

---

## 5. Environment Switching Summary

- Both dev and prod use `process.env.DATABASE_URL`.
- `NODE_ENV` determines behavior in `src/config/database.js`:
  - **Dev (`NODE_ENV=development`)**
    - Uses Neon Local fetch endpoint (`http://neon-local:5432/sql`).
    - `DATABASE_URL` points to Neon Local Postgres (`postgres://neon:npg@neon-local:5432/neondb`).
  - **Prod (`NODE_ENV=production`)**
    - No Neon Local override.
    - `DATABASE_URL` points to Neon Cloud (`...neon.tech...`).

- Compose files:
  - `docker-compose.dev.yml` + `.env.development` → Neon Local.
  - `docker-compose.prod.yml` + `.env.production` → Neon Cloud.

---

## 6. Non-Docker Local Run (Optional)

You can still run the app directly on your machine for quick iteration:

```bash
npm install
npm run dev
```

Requirements:

- `DATABASE_URL` must be set in your environment or `.env`.
- You can point `DATABASE_URL` either at Neon Cloud or a running Neon Local instance.

---

## 7. Common Tasks

### 7.1 Rebuild images after dependency changes

```bash
# Dev
</