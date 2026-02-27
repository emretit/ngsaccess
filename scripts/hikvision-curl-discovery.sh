#!/bin/bash
# Hikvision cihazda "neyin ne olduğunu" tek seferde curl ile listeler.
# Menüde ISAPI görünmüyorsa tüm bilgi bu script çıktısından okunabilir.
# Kullanım: ./scripts/hikvision-curl-discovery.sh
#          HIKVISION_IP=192.168.1.27 ./scripts/hikvision-curl-discovery.sh

DEVICE="${HIKVISION_IP:-192.168.1.27}"
USER="${HIKVISION_USER:-admin}"
PASS="${HIKVISION_PASS:-ngs05278}"
C="curl -s -k -u $USER:$PASS --digest --connect-timeout 5"

echo "=============================================================="
echo "  Hikvision ISAPI – Neyin Nesi? (Curl ile discovery)"
echo "  Cihaz: $DEVICE"
echo "=============================================================="

section() {
  echo ""
  echo "--- $1 ---"
  echo "  NE: $2"
  echo "  URL: $3"
  echo ""
}

# 1. Cihaz bilgisi
section \
  "1. Cihaz bilgisi (deviceInfo)" \
  "Model, seri no, firmware. ngsaccess'te cihaz eklerken serialNumber buradan alınır." \
  "GET /ISAPI/System/deviceInfo"
$C "http://$DEVICE/ISAPI/System/deviceInfo" 2>/dev/null | sed 's/></>\n</g' | grep -E "deviceName|model|serialNumber|firmwareVersion|macAddress" || echo "(bağlantı hatası veya boş)"

# 2. httpHosts yetenek
section \
  "2. HTTP Listening destekleniyor mu? (httpHosts/capabilities)" \
  "HttpHostNotificationCap=true ise event'i Convex'e gönderebilirsiniz." \
  "GET /ISAPI/Event/notification/httpHosts/capabilities"
$C "http://$DEVICE/ISAPI/Event/notification/httpHosts/capabilities" 2>/dev/null | sed 's/></>\n</g' | head -20 || echo "(bağlantı hatası veya boş)"

# 3. Tüm HTTP Host listesi
section \
  "3. HTTP Host listesi (event nereye gidiyor?)" \
  "url = Convex adresi olmalı. Host 1 genelde ngsaccess için kullanılır." \
  "GET /ISAPI/Event/notification/httpHosts"
$C "http://$DEVICE/ISAPI/Event/notification/httpHosts" 2>/dev/null | sed 's/></>\n</g' | grep -E "url>|protocolType|parameterFormatType|hostName|enabled|id>|method" || echo "(bağlantı hatası veya boş)"

# 4. Sadece Host 1
section \
  "4. Host 1 tek (Convex URL ayarı)" \
  "Buradaki url değerini PUT ile değiştirerek Convex'e gönderim ayarlanır." \
  "GET /ISAPI/Event/notification/httpHosts/1"
$C "http://$DEVICE/ISAPI/Event/notification/httpHosts/1" 2>/dev/null | sed 's/></>\n</g' || echo "(bağlantı hatası veya boş)"

# 5. Ağ (IP, DNS)
section \
  "5. Ağ – Interface 1 (IP, DNS, gateway)" \
  "Hostname ile Convex'e gidiyorsa DNSEnable=true olmalı." \
  "GET /ISAPI/System/network/interfaces/1"
$C "http://$DEVICE/ISAPI/System/network/interfaces/1" 2>/dev/null | sed 's/></>\n</g' | grep -E "ipAddress>|DNSEnable|subnetMask|DefaultGateway|PrimaryDNS|SecondaryDNS" || echo "(bağlantı hatası veya boş)"

echo ""
echo "=============================================================="
echo "  Bitti. Detaylı curl örnekleri: docs/HIKVISION_CURL_ISAPI_REHBERI.md"
echo "=============================================================="
