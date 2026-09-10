#!/usr/bin/env bash
set -euo pipefail
: "${MYSQL_CONFIG:?Set protected MySQL client config for the restore server}"
: "${RESTORE_DATABASE:?Set a new database ending in _restore}"
: "${BACKUP_FILE:?Set local gzip backup path}"
case "$RESTORE_DATABASE" in
  *_restore) ;;
  *) echo 'Refusing to restore into a non-restore database' >&2; exit 1 ;;
esac
[[ "$RESTORE_DATABASE" =~ ^[a-zA-Z0-9_]+$ ]] || exit 1
gzip -t "$BACKUP_FILE"
mysql --defaults-extra-file="$MYSQL_CONFIG" -e "CREATE DATABASE \`$RESTORE_DATABASE\` CHARACTER SET utf8mb4;"
gzip -dc "$BACKUP_FILE" | mysql --defaults-extra-file="$MYSQL_CONFIG" "$RESTORE_DATABASE"
echo 'Restore complete. Compare row counts and run the acceptance flow against this isolated database.'
