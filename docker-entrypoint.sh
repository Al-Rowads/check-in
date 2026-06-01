#!/bin/sh
set -eu

: "${CHECKIN_DATA_DIR:=/app/data}"

mkdir -p "$CHECKIN_DATA_DIR"

if [ "$(id -u)" = "0" ]; then
  if ! chown -R node:node "$CHECKIN_DATA_DIR"; then
    echo "Could not make $CHECKIN_DATA_DIR writable for the node user." >&2
    echo "Check the host directory permissions for the Docker volume." >&2
    exit 1
  fi

  exec su-exec node "$@"
fi

exec "$@"
