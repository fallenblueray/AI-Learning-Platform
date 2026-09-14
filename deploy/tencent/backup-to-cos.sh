#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")"
test -f .env.production
test -f .env.backup
set -a
# shellcheck disable=SC1091
source ./.env.backup
set +a
: "${BACKUP_BUCKET:?Set BACKUP_BUCKET in the protected environment file}"
: "${S3_ENDPOINT:?Set S3_ENDPOINT}"
: "${S3_REGION:?Set S3_REGION}"
: "${S3_ACCESS_KEY:?Set S3_ACCESS_KEY}"
: "${S3_SECRET_KEY:?Set S3_SECRET_KEY}"
task_dir="$(mktemp -d)"
stamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
archive="$task_dir/pt-academy-$stamp.sql.gz"
trap 'rm -rf -- "$task_dir"' EXIT
docker compose --env-file .env.production exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --routines --triggers --set-gtid-purged=OFF --no-tablespaces pt_academy' \
  | gzip -9 > "$archive"
gzip -t "$archive"
AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY" AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY" AWS_DEFAULT_REGION="$S3_REGION" \
  aws --endpoint-url "$S3_ENDPOINT" s3 cp "$archive" "s3://$BACKUP_BUCKET/mysql/daily/$(basename "$archive")" \
  --sse AES256 --only-show-errors
sha256sum "$archive" | sed "s|$archive|$(basename "$archive")|" > "$archive.sha256"
AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY" AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY" AWS_DEFAULT_REGION="$S3_REGION" \
  aws --endpoint-url "$S3_ENDPOINT" s3 cp "$archive.sha256" "s3://$BACKUP_BUCKET/mysql/daily/$(basename "$archive").sha256" \
  --sse AES256 --only-show-errors
