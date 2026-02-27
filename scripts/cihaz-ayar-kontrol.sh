#!/bin/bash
# Hikvision cihaz ayarlarını adım adım curl ile kontrol eder.
# Kullanım: ./scripts/cihaz-ayar-kontrol.sh
#          HIKVISION_IP=192.168.1.50 ./scripts/cihaz-ayar-kontrol.sh

set -e
DEVICE="${HIKVISION_IP:-192.168.1.212}"
USER="${HIKVISION_USER:-admin}"
PASS="${HIKVISION_PASS:-ngs05278}"
C="curl -s -k -u $USER:$PASS --digest --connect-timeout 8"

echo "=============================================="
echo "  Cihaz ayar kontrolü (adım adım)"
echo "  Cihaz: $DEVICE"
echo "=============================================="
echo ""

# --- Adım 1: Cihaza erişim ve deviceInfo ---
echo "--- Adım 1: Cihaza erişim ve deviceInfo ---"
RESP=$(curl -s -w "\n%{http_code}" -k -u "$USER:$PASS" --digest --connect-timeout 8 "http://$DEVICE/ISAPI/System/deviceInfo" 2>/dev/null) || true
HTTP_CODE=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')

if [[ -z "$BODY" || "$HTTP_CODE" == "000" ]]; then
  echo "  ❌ Cihaza bağlanılamadı (IP: $DEVICE, timeout veya ağ erişimi yok)."
  echo "  → Cihaz açık mı? Aynı ağda mısınız? HIKVISION_IP doğru mu?"
  exit 1
fi

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "  ❌ HTTP $HTTP_CODE (beklenen 200). Kullanıcı/şifre veya yetki kontrol edin."
  echo "$BODY" | head -5
  exit 1
fi

echo "  ✅ Cihaza erişim OK (HTTP 200)"
echo ""
echo "  Cihaz bilgisi:"
echo "$BODY" | sed 's/></>\n</g' | grep -E "deviceName|model|serialNumber|firmwareVersion|macAddress" | sed 's/^/    /'
echo ""

# --- Adım 2: HTTP Hosts destek (capabilities) ---
echo "--- Adım 2: HTTP Listening destekleniyor mu? (httpHosts/capabilities) ---"
CAP=$($C "http://$DEVICE/ISAPI/Event/notification/httpHosts/capabilities" 2>/dev/null || true)
if echo "$CAP" | grep -qi "HttpHostNotificationCap.*true"; then
  echo "  ✅ HttpHostNotificationCap = true (event HTTP ile gönderilebilir)"
else
  echo "  ⚠️  Destek bilgisi bulunamadı veya false. Ham yanıt:"
  echo "$CAP" | sed 's/></>\n</g' | head -15 | sed 's/^/    /'
fi
echo ""

# --- Adım 3: Mevcut httpHosts (event nereye gidiyor) ---
echo "--- Adım 3: Mevcut HTTP Host ayarı (event nereye gidiyor?) ---"
HOSTS=$($C "http://$DEVICE/ISAPI/Event/notification/httpHosts" 2>/dev/null || true)
if [[ -n "$HOSTS" ]]; then
  URL=$(echo "$HOSTS" | sed -n 's/.*<url>\([^<]*\)<\/url>.*/\1/p' | head -1)
  HOST_NAME=$(echo "$HOSTS" | sed -n 's/.*<hostName>\([^<]*\)<\/hostName>.*/\1/p' | head -1)
  PROTO=$(echo "$HOSTS" | sed -n 's/.*<protocolType>\([^<]*\)<\/protocolType>.*/\1/p' | head -1)
  ENABLED=$(echo "$HOSTS" | sed -n 's/.*<enabled>\([^<]*\)<\/enabled>.*/\1/p' | head -1)
  echo "  URL       : ${URL:-boş}"
  echo "  hostName  : ${HOST_NAME:-boş}"
  echo "  protocol  : ${PROTO:-boş}"
  echo "  enabled   : ${ENABLED:-boş}"
  if [[ -n "$URL" ]]; then
    echo "  ✅ Host 1 yapılandırılmış (event’ler bu adrese gidecek)"
  else
    echo "  ⚠️  URL boş; event’ler dışarı gönderilmiyor. PUT ile url ayarlayın."
  fi
else
  echo "  ❌ httpHosts yanıtı alınamadı"
fi
echo ""

# --- Adım 4: Ağ / DNS ---
echo "--- Adım 4: Ağ ayarları (IP, DNS) ---"
NET=$($C "http://$DEVICE/ISAPI/System/network/interfaces/1" 2>/dev/null || true)
if [[ -n "$NET" ]]; then
  IP=$(echo "$NET" | sed -n 's/.*<ipAddress>\([^<]*\)<\/ipAddress>.*/\1/p' | head -1)
  DNS_EN=$(echo "$NET" | sed -n 's/.*<DNSEnable>\([^<]*\)<\/DNSEnable>.*/\1/p' | head -1)
  GW=$(echo "$NET" | sed -n 's/.*<defaultGateway>\([^<]*\)<\/defaultGateway>.*/\1/p' | head -1)
  echo "  IP        : ${IP:-boş}"
  echo "  Gateway   : ${GW:-boş}"
  echo "  DNSEnable : ${DNS_EN:-boş}"
  if echo "$DNS_EN" | grep -qi "true"; then
    echo "  ✅ DNS açık (hostname ile Convex’e gidebilir)"
  else
    echo "  ⚠️  DNS kapalı; Convex URL’i hostname ise event’ler gitmeyebilir (IP kullanın veya DNS açın)"
  fi
else
  echo "  ❌ Ağ yanıtı alınamadı"
fi
echo ""

echo "=============================================="
echo "  Kontrol tamamlandı."
echo "  URL ayarlamak için: docs/HIKVISION_CURL_ISAPI_REHBERI.md"
echo "=============================================="
