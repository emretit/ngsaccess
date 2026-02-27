#!/bin/bash
# Hikvision cihazın ISAPI ayarlarını curl ile gösterir.
# Kullanım: ./scripts/hikvision-isapi-ayarlar.sh [IP]
# Örnek:   HIKVISION_IP=192.168.1.27 ./scripts/hikvision-isapi-ayarlar.sh

DEVICE="${HIKVISION_IP:-192.168.1.27}"
USER="${HIKVISION_USER:-admin}"
PASS="${HIKVISION_PASS:-ngs05278}"
C="curl -s -k -u $USER:$PASS --digest --connect-timeout 5"

echo "=============================================="
echo "  Hikvision ISAPI Ayarları - $DEVICE"
echo "=============================================="

echo ""
echo "--- 1. Cihaz bilgisi (deviceInfo) ---"
$C "http://$DEVICE/ISAPI/System/deviceInfo" 2>/dev/null | sed 's/></>\n</g' | grep -E "deviceName|model|serialNumber|firmwareVersion|macAddress"

echo ""
echo "--- 2. HTTP Hosts (event nereye gidiyor) ---"
$C "http://$DEVICE/ISAPI/Event/notification/httpHosts" 2>/dev/null | sed 's/></>\n</g' | grep -E "url>|protocolType|parameterFormatType|hostName|SubscribeEvent|type>Access"

echo ""
echo "--- 3. Ağ (Interface 1: IP, DNS, gateway) ---"
$C "http://$DEVICE/ISAPI/System/network/interfaces/1" 2>/dev/null | sed 's/></>\n</g' | grep -E "ipAddress>|DNSEnable|subnetMask|DefaultGateway|PrimaryDNS"

echo ""
echo "--- 4. httpHosts capabilities (desteklenen özellikler) ---"
$C "http://$DEVICE/ISAPI/Event/notification/httpHosts/capabilities" 2>/dev/null | sed 's/></>\n</g' | head -25

echo ""
echo "Bitti. Tüm ham XML için: curl -s -k -u $USER:**** --digest \"http://$DEVICE/ISAPI/...\" "
