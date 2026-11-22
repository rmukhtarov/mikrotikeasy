#!/usr/bin/env bash
# Build the distributable source bundle: dist/mikrotikeasy-<version>.tar.gz
# Optional prebuilt image (for hosts without internet): docker save mikrotikeasy:latest -o dist/mikrotikeasy-image-<version>.tar
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION="${1:-1.0.0}"
mkdir -p dist
tar --force-local -czf "dist/mikrotikeasy-$VERSION.tar.gz" --transform 's,^,mikrotikeasy/,' \
  Dockerfile .dockerignore docker-compose.yml docker-compose.build.yml .env.example install.sh README.md LICENSE package.json \
  server.mjs prompts.mjs schema.mjs settings.mjs data/ros-schema.json data/mistakes.json public
echo "dist/mikrotikeasy-$VERSION.tar.gz"
