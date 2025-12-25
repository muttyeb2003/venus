#!/bin/bash
set -e

APP_SERVICE="app"
COMPOSE_FILE="docker-compose.dev.yml"

API_URL="http://localhost:3000"
DB_URL="postgresql://neon:npg@localhost:5432/neondb"

echo "🚀 Starting Acquisition App in Development Mode"
echo "================================================"

restore_tty() {
  stty echo 2>/dev/null || true
  stty sane 2>/dev/null || true
  tput cnorm 2>/dev/null || true
  reset 2>/dev/null || true
}

cleanup() {
  trap - INT TERM EXIT
  echo ""
  echo "🛑 Stopping development environment..."
  restore_tty
  docker compose -f "$COMPOSE_FILE" down >/dev/null 2>&1 || true

  echo "✅ Stopped."
}
trap cleanup INT TERM EXIT

if [ ! -f .env.development ]; then
  echo "❌ Error: .env.development file not found!"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "❌ Error: Docker is not running!"
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
echo "📦 Building and starting containers..."
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
echo "📌 Press Ctrl+C to stop everything"
echo ""

# Open browser (Windows)
if command -v cmd.exe >/dev/null 2>&1; then
  echo "🌐 Opening $API_URL in your browser..."
  cmd.exe /c start "$API_URL" >/dev/null 2>&1 || true
fi

echo "📜 Following logs (Ctrl+C stops + cleans up)..."
docker compose -f "$COMPOSE_FILE" logs -f
