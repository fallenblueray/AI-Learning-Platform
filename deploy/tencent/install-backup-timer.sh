#!/usr/bin/env bash
set -euo pipefail
if [[ "${EUID}" -ne 0 ]]; then
  echo '請以 sudo 執行。' >&2
  exit 1
fi
cd "$(dirname "$0")"
chmod 700 backup-to-cos.sh
chmod 600 .env.production .env.backup
install -m 0644 innovate-academy-backup.service /etc/systemd/system/
install -m 0644 innovate-academy-backup.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now innovate-academy-backup.timer
systemctl start innovate-academy-backup.service
systemctl status innovate-academy-backup.service --no-pager
systemctl list-timers innovate-academy-backup.timer --no-pager
