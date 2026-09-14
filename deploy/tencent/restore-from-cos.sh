#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")"
: "${BACKUP_OBJECT:?Set the COS object key under mysql/daily/}"
[[ "$BACKUP_OBJECT" == mysql/daily/*.sql.gz ]] || { echo '備份路徑不符合預期' >&2; exit 1; }
set -a
# shellcheck disable=SC1091
source ./.env.backup
set +a
task_dir="$(mktemp -d)"
archive="$task_dir/restore.sql.gz"
checksum="$archive.sha256"
trap 'rm -rf -- "$task_dir"' EXIT
AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY" AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY" AWS_DEFAULT_REGION="$S3_REGION" \
  aws --endpoint-url "$S3_ENDPOINT" s3 cp "s3://$BACKUP_BUCKET/$BACKUP_OBJECT" "$archive" --only-show-errors
AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY" AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY" AWS_DEFAULT_REGION="$S3_REGION" \
  aws --endpoint-url "$S3_ENDPOINT" s3 cp "s3://$BACKUP_BUCKET/$BACKUP_OBJECT.sha256" "$checksum" --only-show-errors
sed -i "s|^[^ ]*  .*|$(cut -d' ' -f1 "$checksum")  $archive|" "$checksum"
sha256sum -c "$checksum"
gzip -t "$archive"
docker compose --env-file .env.production exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -e "DROP DATABASE IF EXISTS pt_academy_restore; CREATE DATABASE pt_academy_restore CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci"'
gzip -dc "$archive" | docker compose --env-file .env.production exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot pt_academy_restore'
echo '已還原至隔離資料庫 pt_academy_restore；尚未取代正式資料庫。'
