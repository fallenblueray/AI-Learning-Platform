#!/usr/bin/env bash
set -euo pipefail
if [[ "${EUID}" -ne 0 ]]; then
  echo '請以 sudo 執行。' >&2
  exit 1
fi
. /etc/os-release
if [[ "${ID}" != ubuntu ]]; then
  echo '此腳本只支援 Ubuntu 22.04/24.04。' >&2
  exit 1
fi
apt-get update
apt-get install -y ca-certificates curl git unzip gnupg unattended-upgrades
bash "$(dirname "$0")/install-aws-cli.sh"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
cat >/etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${VERSION_CODENAME}
Components: stable
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker unattended-upgrades
if [[ ! -e /swapfile ]] && (( $(awk '/MemTotal/{print $2}' /proc/meminfo) < 6000000 )); then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  printf '/swapfile none swap sw 0 0\n' >> /etc/fstab
fi
install -d -m 0750 /opt/innovate-academy
echo '主機基本套件已安裝。請在騰訊 Lighthouse 防火牆只保留管理用 SSH 入站規則。'
