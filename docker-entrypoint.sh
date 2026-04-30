#!/bin/sh
set -e

echo "[entrypoint] attempts-service: prisma generate…"
npx --no-install prisma generate

echo "[entrypoint] attempts-service: prisma db push…"
npx --no-install prisma db push --skip-generate --accept-data-loss || {
  echo "[entrypoint] db push failed — service will exit"
  exit 1
}

echo "[entrypoint] starting: $@"
exec "$@"
