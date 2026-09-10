#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
: "${API_IMAGE:?Provide versioned API_IMAGE}"
: "${WEB_IMAGE:?Provide versioned WEB_IMAGE}"
docker compose -f compose.production.yaml pull
docker compose -f compose.production.yaml run --rm --no-deps api node dist/database/migrate.js
docker compose -f compose.production.yaml up -d --wait --wait-timeout 120
docker compose -f compose.production.yaml ps
