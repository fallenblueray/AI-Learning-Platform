#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
test -f .env.production
chmod 600 .env.production
docker compose --env-file .env.production build --pull
docker compose --env-file .env.production up -d --wait --wait-timeout 180 mysql
docker compose --env-file .env.production run --rm --no-deps api node dist/database/migrate.js
docker compose --env-file .env.production up -d --wait --wait-timeout 180
docker compose --env-file .env.production ps
docker compose --env-file .env.production exec -T web wget -qO- http://api:3000/health/ready
