#!/usr/bin/env bash
# Tek sefer: LAN IP → forwarder → cihaz httpHosts'u HTTP + bu PC'ye yönlendir
# Kullanım: HIK_PASS='ngs05278' ./scripts/setup-hikvision-forward-full.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env.local ]]; then
  export $(grep -v '^#' .env.local | grep -E '^VITE_CONVEX_SITE_URL=' | xargs)
fi
UPSTREAM="${VITE_CONVEX_SITE_URL:-https://notable-tern-4.convex.site}/card-reader"
FORWARD_PORT="${FORWARD_PORT:-8765}"
HIK_IP="${HIK_IP:-192.168.1.164}"
HIK_USER="${HIK_USER:-admin}"
HIK_PASS="${HIK_PASS:-}"

LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)
if [[ -z "$LAN_IP" ]]; then
  LAN_IP=$(ifconfig 2>/dev/null | awk '/inet / && $2 !~ /^127\./ {print $2; exit}')
fi
if [[ -z "$LAN_IP" ]]; then
  echo "LAN IP bulunamadı."
  exit 1
fi

LOCAL_URL="http://${LAN_IP}:${FORWARD_PORT}/card-reader"
XML_FILE="/tmp/hik-http-host1-$$.xml"

cat > "$XML_FILE" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<HttpHostNotification version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
<id>1</id>
<url>${LOCAL_URL}</url>
<protocolType>HTTP</protocolType>
<parameterFormatType>JSON</parameterFormatType>
<addressingFormatType>ipaddress</addressingFormatType>
<ipAddress>${LAN_IP}</ipAddress>
<portNo>${FORWARD_PORT}</portNo>
<httpAuthenticationMethod>none</httpAuthenticationMethod>
<SubscribeEvent><heartbeat>30</heartbeat><eventMode>all</eventMode><EventList><Event><type>AccessControllerEvent</type><minorAlarm></minorAlarm><minorException></minorException><minorOperation></minorOperation><minorEvent></minorEvent><pictureURLType>binary</pictureURLType></Event></EventList></SubscribeEvent>
</HttpHostNotification>
EOF

echo "=============================================="
echo "  1) LAN IP: $LAN_IP"
echo "  2) Forwarder: http://0.0.0.0:${FORWARD_PORT}/card-reader → $UPSTREAM"
echo "  3) Cihaz hedefi: $LOCAL_URL"
echo "=============================================="

# Eski forwarder varsa kapat
pkill -f "forward-card-reader-to-convex.mjs" 2>/dev/null || true
sleep 1

CONVEX_CARD_READER_URL="$UPSTREAM" FORWARD_PORT="$FORWARD_PORT" \
  nohup node "$ROOT/scripts/forward-card-reader-to-convex.mjs" >> /tmp/hikvision-forwarder.log 2>&1 &
sleep 2

if curl -sS -o /dev/null -w "%{http_code}" "http://127.0.0.1:${FORWARD_PORT}/card-reader" | grep -q 200; then
  echo "OK: Forwarder ayakta (GET /card-reader)."
else
  echo "HATA: Forwarder cevap vermiyor."
  exit 1
fi

if [[ -z "$HIK_PASS" ]]; then
  echo ""
  echo "HIK_PASS verilmedi — cihaz ISAPI atlandı."
  echo "Tam kurulum için:"
  echo "  HIK_PASS='...' $0"
  echo ""
  echo "Manuel: Hikvision web → httpHosts URL = $LOCAL_URL"
  exit 0
fi

echo ""
echo "--- Cihaz httpHosts/1 PUT ($HIK_IP) ---"
RESP=$(curl -sk --digest -u "${HIK_USER}:${HIK_PASS}" -X PUT \
  --connect-timeout 15 --max-time 45 \
  -H "Content-Type: application/xml; charset=UTF-8" \
  --data-binary @"$XML_FILE" \
  "https://${HIK_IP}/ISAPI/Event/notification/httpHosts/1" -w "\nHTTP:%{http_code}" || echo "curl_failed")

echo "$RESP"
rm -f "$XML_FILE"

if echo "$RESP" | grep -q "statusString>OK</statusString"; then
  echo "OK: Cihaz httpHosts güncellendi."
else
  echo "Cihaz yanıtını kontrol et (OK / hata kodu)."
fi

echo ""
echo "Sonraki: Kart okut → Convex Logs → card-reader"
echo "Forwarder log: tail -f /tmp/hikvision-forwarder.log"
echo "Durdur: pkill -f forward-card-reader-to-convex"
