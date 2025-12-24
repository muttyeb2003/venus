#!/bin/bash
set -e

APP_SERVICE="app"
COMPOSE_FILE="docker-compose.dev.yml"

API_URL="http://localhost:3000"
DB_URL="postgresql://neon:npg@localhost:5432/neondb"

echo "🚀 Starting Acquisition App in Development Mode"
echo "================================================"

cleanup() {
  echo ""
  echo "🛑 Stopping development environment..."
  docker compose -f "$COMPOSE_FILE" down >/dev/null 2>&1 || true
  echo "✅ Stopped."
}
trap cleanup INT TERM

if [ ! -f .env.development ]; then
  echo "❌ Error: .env.development file not found!"
  echo "   Create/copy .env.development and add your env vars."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "❌ Error: Docker is not running!"
  echo "   Start Docker Desktop and try again."
  exit 1
fi

mkdir -p .neon_local
if [ -f .gitignore ] && ! grep -q ".neon_local/" .gitignore 2>/dev/null; then
  echo ".neon_local/" >> .gitignore
  echo "✅ Added .neon_local/ to .gitignore"
fi

echo ""
echo "🧹 Cleaning any previous run (avoids port conflicts)..."
docker compose -f "$COMPOSE_FILE" down >/dev/null 2>&1 || true

echo ""
echo "📦 Building and starting development containers..."
echo "   - Neon Local proxy will create an ephemeral database branch"
echo "   - Application will run with hot reload enabled"
echo ""

docker compose -f "$COMPOSE_FILE" up --build -d

echo "⏳ Waiting for app container to be running..."
APP_CID="$(docker compose -f "$COMPOSE_FILE" ps -q "$APP_SERVICE" || true)"
if [ -z "$APP_CID" ]; then
  echo "❌ Error: Could not find container for service '$APP_SERVICE'."
  echo "   Run: docker compose -f $COMPOSE_FILE ps"
  exit 1
fi

for i in {1..90}; do
  if docker inspect -f '{{.State.Running}}' "$APP_CID" 2>/dev/null | grep -q true; then
    break
  fi
  sleep 1
done

sleep 2

echo "📜 Applying latest schema with Drizzle (inside container)..."
docker compose -f "$COMPOSE_FILE" exec -T "$APP_SERVICE" npm run db:migrate

echo ""
echo "🎉 Development environment started!"
echo "================================================"
echo "✅ API:        $API_URL"
echo "✅ DB (local): $DB_URL"
echo ""
echo "📌 To stop everything: press Ctrl+C"
echo ""

# Auto-open API URL in browser on Windows (Git Bash/MSYS)
if command -v cmd.exe >/dev/null 2>&1; then
  echo "🌐 Opening $API_URL in your browser..."
  cmd.exe /c start "$API_URL" >/dev/null 2>&1 || true
fi

# Follow logs
docker compose -f "$COMPOSE_FILE" logs -f
