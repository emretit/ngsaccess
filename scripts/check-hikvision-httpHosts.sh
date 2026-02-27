#!/bin/bash
# Hikvision HTTP Listening (httpHosts) yapılandırmasını kontrol eder
# Kullanım: ./scripts/check-hikvision-httpHosts.sh

DEVICE_IP="${HIKVISION_IP:-192.168.1.27}"
USER="${HIKVISION_USER:-admin}"
PASS="${HIKVISION_PASS:-ngs05278}"

echo "=== Hikvision HTTP Hosts Kontrolü ==="
echo "Cihaz: $DEVICE_IP"
echo ""

RESPONSE=$(curl -s -u "$USER:$PASS" --digest "http://$DEVICE_IP/ISAPI/Event/notification/httpHosts" 2>/dev/null)

if [[ -z "$RESPONSE" ]]; then
  echo "HATA: Cihaza bağlanılamadı."
  exit 1
fi

# Host 1 özet
URL=$(echo "$RESPONSE" | grep -oP '<url>\K[^<]+' | head -1)
HOST=$(echo "$RESPONSE" | grep -oP '<hostName>\K[^<]+' | head -1)
PROTO=$(echo "$RESPONSE" | grep -oP '<protocolType>\K[^<]+' | head -1)

echo "Host 1 (ngsaccess):"
echo "  URL     : ${URL:-boş}"
echo "  Host    : ${HOST:-boş}"
echo "  Protokol: ${PROTO:-boş}"
echo ""
echo "Durum: ${URL:+✅ Yapılandırılmış}${URL:-❌ Boş}"
echo ""
echo "Tam yanıt (XML):"
echo "$RESPONSE" | sed 's/></>\n</g'
