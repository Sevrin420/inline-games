#!/usr/bin/env bash
# Ship the Death Race server to the VPS: ./death-race-server/deploy.sh [ssh-target]
# Copies server + shared.js to /opt/death-race-server, installs/restarts the systemd unit.
set -euo pipefail
T=${1:-vps}
cd "$(dirname "$0")/.."
ssh ${SSH_OPTS:-} "$T" 'mkdir -p /opt/death-race-server'
scp -q ${SSH_OPTS:-} death-race-server/server.js death-race-server/ws.js games/death-race/shared.js "$T":/opt/death-race-server/
scp -q ${SSH_OPTS:-} death-race-server/death-race.service "$T":/etc/systemd/system/death-race.service
ssh ${SSH_OPTS:-} "$T" 'systemctl daemon-reload && systemctl enable death-race >/dev/null 2>&1; systemctl restart death-race; sleep 1; systemctl is-active death-race; curl -s 127.0.0.1:3110/death-race/status'
