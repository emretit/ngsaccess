#!/bin/bash
# Hikvision cihazda event ile ilgili ISAPI endpoint'lerini curl ile kontrol eder.
# Kullanım: HIKVISION_IP=192.168.1.212 ./scripts/cihaz-event-endpointleri.sh

DEVICE="${HIKVISION_IP:-192.168.1.212}"
USER="${HIKVISION_USER:-admin}"
PASS="${HIKVISION_PASS:-ngs05278}"
C="curl -s -o /dev/null -w %{http_code} -k -u $USER:$PASS --digest --connect-timeout 6"

echo "=============================================="
echo "  Event ile ilgili ISAPI endpoint'leri"
echo "  Cihaz: $DEVICE"
echo "=============================================="
echo ""

check() {
  local path="$1"
  local desc="$2"
  code=$(curl -s -o /dev/null -w "%{http_code}" -k -u "$USER:$PASS" --digest --connect-timeout 6 "http://$DEVICE$path" 2>/dev/null)
  if [[ "$code" == "200" ]]; then
    echo "  ✅ $path  → HTTP $code  ($desc)"
  else
    echo "  ❌ $path  → HTTP $code  ($desc)"
  fi
}

echo "--- Event / HTTP Listening (event nereye gidecek) ---"
check "/ISAPI/Event/notification/httpHosts"           "Tüm HTTP Host listesi"
check "/ISAPI/Event/notification/httpHosts/1"         "Host 1 (ngsaccess URL)"
check "/ISAPI/Event/notification/httpHosts/capabilities" "httpHosts destekleniyor mu?"
echo "  (POST httpHosts/1/test = test event gönderir; bazı cihazlarda 400 döner)"
echo ""

echo "--- Event abonelik / stream ---"
check "/ISAPI/Event/notification/subscribeEventCap"   "Abone olunabilir event tipleri"
echo "  (GET alertStream = canlı event stream, uzun süre açık kalır)"
echo ""

echo "--- Erişim kontrolü / event yapılandırma ---"
check "/ISAPI/AccessControl/capabilities"            "Erişim kontrol yetenekleri"
check "/ISAPI/AccessControl/AcsEvent/StorageCfg?format=json" "Event depolama ayarı"
check "/ISAPI/AccessControl/EventCardLinkageCfg/capabilities" "Event-kart ilişkilendirme"
echo ""

echo "--- Özet ---"
echo "  • Event’lerin dışarı gönderilmesi: httpHosts (Host 1 URL)"
echo "  • Hangi event tipleri var: subscribeEventCap"
echo "  • Event-kapı/kart bağlantısı: EventCardLinkageCfg"
echo "  • Web arayüzü: https://$DEVICE/doc/index.html#/config/door/terminalParameters"
echo "=============================================="
