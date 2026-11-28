#!/usr/bin/env bash
# Sunucudaki mevcut servislerin sağlık anlık görüntüsü (salt okuma). Kullanım: health-snapshot.sh > dosya
set -u
echo "# $(date -u +%FT%TZ)"
for s in nginx DeviceGatewayService DeviceGatewayGuard ngs-hik-event-bridge ngs-hik-relay pafta-api pafta-seo-worker docker; do
  printf '%-24s %s | since=%s | restarts=%s\n' "$s" "$(systemctl is-active "$s")" \
    "$(systemctl show -p ActiveEnterTimestamp --value "$s")" "$(systemctl show -p NRestarts --value "$s")"
done
echo "## docker"
docker ps --format '{{.Names}} | {{.Status}} | started={{.RunningFor}}'
echo "## listen (tcp)"
ss -ltnH | awk '{print $4}' | sort -u | tr '\n' ' '; echo
echo "## http probes (status kodu)"
probe() { printf '%-40s %s\n' "$1" "$(curl -sk -o /dev/null -m 8 -w '%{http_code}' "$2")"; }
probe "openclaw 127.0.0.1:18789/health" http://127.0.0.1:18789/health
probe "gotenberg 127.0.0.1:3001/health" http://127.0.0.1:3001/health
probe "gateway 127.0.0.1:8088/" http://127.0.0.1:8088/
probe "card-relay 127.0.0.1:8090/" http://127.0.0.1:8090/
probe "hik-relay https relay.ngsplus.app/" https://relay.ngsplus.app/
probe "pafta https api.pafta.app/" https://api.pafta.app/
probe "openclaw https sslip/" https://157.90.114.86.sslip.io/
probe "convex 127.0.0.1:3210/version" http://127.0.0.1:3210/version
echo "## load / mem"
uptime; free -m | sed -n 2p
