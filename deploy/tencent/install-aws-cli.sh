#!/usr/bin/env bash
set -euo pipefail
if [[ "${EUID}" -ne 0 ]]; then
  echo '請以 sudo 執行。' >&2
  exit 1
fi
if command -v aws >/dev/null 2>&1; then
  aws --version
  exit 0
fi
for tool in curl unzip gpg; do
  command -v "$tool" >/dev/null || { echo "缺少安裝依賴：$tool" >&2; exit 1; }
done
umask 077
task_dir="$(mktemp -d)"
trap 'rm -rf -- "$task_dir"' EXIT
# 官方安裝腳本會驗證 Linux 安裝包的 GPG 簽章；版本固定以便重現部署。
curl -fsSL --max-time 60 https://awscli.amazonaws.com/v2/install.sh -o "$task_dir/install.sh"
bash "$task_dir/install.sh" --system --version "${AWS_CLI_VERSION:-2.37.8}"
aws --version
