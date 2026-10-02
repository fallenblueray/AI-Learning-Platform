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
printf '[default]\ns3 =\n    addressing_style = virtual\n' > "$task_dir/aws-config"
export AWS_CONFIG_FILE="$task_dir/aws-config"
docker compose --env-file .env.production exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --routines --triggers --set-gtid-purged=OFF --no-tablespaces pt_academy' \
  | gzip -9 > "$archive"
gzip -t "$archive"
sha256sum "$archive" | sed "s|$archive|$(basename "$archive")|" > "$archive.sha256"
upload_backup() {
  local prefix="$1"
  local file
  for file in "$archive" "$archive.sha256"; do
    AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY" AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY" AWS_DEFAULT_REGION="$S3_REGION" \
      AWS_REQUEST_CHECKSUM_CALCULATION=WHEN_REQUIRED AWS_RESPONSE_CHECKSUM_VALIDATION=WHEN_REQUIRED \
      aws --endpoint-url "$S3_ENDPOINT" s3 cp "$file" "s3://$BACKUP_BUCKET/$prefix/$(basename "$file")" \
      --sse AES256 --only-show-errors
  done
}
upload_backup mysql/daily
if [[ "$(TZ=Asia/Hong_Kong date +%d)" == '01' ]]; then
  upload_backup mysql/monthly
fi
