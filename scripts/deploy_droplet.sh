#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/lastreia}"
REPO_URL="${REPO_URL:-https://github.com/leonardo-lacerda/LeadFlow.git}"
BRANCH="${BRANCH:-main}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

for cmd in git docker; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd"
    exit 1
  fi
done

if [ ! -d "$APP_DIR/.git" ]; then
  mkdir -p "$APP_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
fi

cd "$APP_DIR"

if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp ".env.example" ".env"
    echo "Created $APP_DIR/.env from .env.example"
  fi
  echo "Missing required secrets in $APP_DIR/.env."
  echo "Fill the .env file and run this script again."
  exit 1
fi

docker compose -f "$COMPOSE_FILE" up -d --build
docker compose -f "$COMPOSE_FILE" ps

echo "Stack deployed with $COMPOSE_FILE"
