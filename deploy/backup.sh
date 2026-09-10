#!/usr/bin/env bash
set -euo pipefail
# MYSQL_CONFIG is a chmod-600 MySQL client option file; no credentials in argv or logs.
: "${MYSQL_CONFIG:?Set protected MySQL option file path}"
: "${BACKUP_BUCKET:?Set private backup bucket}"
: "${BACKUP_ENDPOINT:?Set Spaces endpoint}"
task_backup="$(mktemp -d)"
trap 'rm -f -- "$task_backup/database.sql.gz"; rmdir -- "$task_backup"' EXIT
mysqldump --defaults-extra-file="$MYSQL_CONFIG" --single-transaction --routines --triggers --set-gtid-purged=OFF --no-tablespaces pt_academy | gzip > "$task_backup/database.sql.gz"
gzip -t "$task_backup/database.sql.gz"
aws --endpoint-url "$BACKUP_ENDPOINT" s3 cp "$task_backup/database.sql.gz" "s3://$BACKUP_BUCKET/daily/$(date -u +%Y-%m-%dT%H-%M-%SZ).sql.gz" --only-show-errors
