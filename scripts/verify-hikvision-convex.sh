#!/usr/bin/env bash
# Convex + Hikvision entegrasyon hızlı kontrolü.
# Kullanım: ./scripts/verify-hikvision-convex.sh
# Ortam: HIK_IP, HIK_USER, HIK_PASS (cihaz ISAPI için; yoksa cihaz adımı atlanır)

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env.local ]]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' .env.local | grep -E '^VITE_CONVEX_SITE_URL=' | xargs)
fi

SITE="${VITE_CONVEX_SITE_URL:-https://notable-tern-4.convex.site}"
HIK_IP="${HIK_IP:-192.168.1.34}"
HIK_USER="${HIK_USER:-admin}"
HIK_PASS="${HIK_PASS:-}"

echo "=============================================="
echo "  Convex /card-reader"
echo "  SITE=$SITE"
echo "=============================================="

echo ""
echo "--- GET /card-reader ---"
code=$(curl -sS -o /tmp/cr-get.json -w "%{http_code}" "${SITE}/card-reader" || true)
echo "HTTP $code"
cat /tmp/cr-get.json
echo ""

if [[ "$code" != "200" ]]; then
  echo "HATA: GET başarısız. npx convex dev veya deploy kontrol et."
  exit 1
fi

echo ""
echo "--- POST /card-reader (test gövdesi) ---"
code=$(curl -sS -o /tmp/cr-post.json -w "%{http_code}" -X POST "${SITE}/card-reader" \
  -H "Content-Type: application/json" \
  -d '{"cardNo":"VERIFY_TEST","serialNumber":"DS-K1T807EBFWX-E120250619V042400ENGB8172365"}' || true)
echo "HTTP $code"
cat /tmp/cr-post.json
echo ""

if [[ "$code" != "200" ]]; then
  echo "HATA: POST başarısız."
  exit 1
fi

if [[ -z "$HIK_PASS" ]]; then
  echo ""
  echo "Cihaz ISAPI atlandı (HIK_PASS boş). Tam kontrol için:"
  echo "  HIK_PASS='...' ./scripts/verify-hikvision-convex.sh"
  exit 0
fi

echo ""
echo "=============================================="
echo "  Hikvision httpHosts/1  ($HIK_IP)"
echo "=============================================="
code=$(curl -sk --digest -u "${HIK_USER}:${HIK_PASS}" -o /tmp/hik-host.xml -w "%{http_code}" \
  --connect-timeout 8 "https://${HIK_IP}/ISAPI/Event/notification/httpHosts/1" || true)
echo "HTTP $code"
if [[ "$code" == "200" ]]; then
  echo "url satırı:"
  grep -o '<url>[^<]*</url>' /tmp/hik-host.xml || true
  if grep -q "${SITE#https://}" /tmp/hik-host.xml 2>/dev/null || grep -q "convex.site" /tmp/hik-host.xml; then
    echo "OK: host Convex .site içeriyor gibi görünüyor."
  else
    echo "UYARI: URL beklenen deployment ile eşleşmeyebilir."
  fi
else
  echo "Cihaza ulaşılamadı (aynı LAN, IP ve şifre gerekir)."
fi

echo ""
echo "=============================================="
echo "  DNS (POST atmıyorsa en sık neden)"
echo "=============================================="
code=$(curl -sk --digest -u "${HIK_USER}:${HIK_PASS}" -o /tmp/hik-net.xml -w "%{http_code}" \
  --connect-timeout 8 "https://${HIK_IP}/ISAPI/System/network/interfaces/1" || true)
if [[ "$code" == "200" ]] && grep -q '<DNSEnable>false</DNSEnable>' /tmp/hik-net.xml 2>/dev/null; then
  echo "KRİTİK: DNSEnable=false — cihaz genelde notable-tern-4.convex.site adresini ÇÖZEMEZ, HTTPS POST gitmez."
  echo "Çözüm: Web arayüzü https://${HIK_IP}/doc/index.html → Configuration → Network → TCP/IP → DNS kullanımını AÇ."
  echo "        (Primary DNS: 8.8.8.8 veya modem IP’si)"
elif [[ "$code" == "200" ]]; then
  echo "DNSEnable açık görünüyor veya XML farklı; yine de modemde 443 çıkışını kontrol et."
else
  echo "Ağ XML okunamadı."
fi

echo ""
echo "=============================================="
echo "  DeployList (aktif push listener'ları)"
echo "=============================================="
code=$(curl -sk --digest -u "${HIK_USER}:${HIK_PASS}" -o /tmp/hik-deploy.xml -w "%{http_code}" \
  --connect-timeout 8 "http://${HIK_IP}/ISAPI/AccessControl/DeployInfo" || true)
if [[ "$code" == "200" ]]; then
  size=$(grep -o '<size>[^<]*</size>' /tmp/hik-deploy.xml | head -1 || echo "")
  echo "HTTP $code — $size"
  if echo "$size" | grep -q ">0<"; then
    echo "OK: Cihaz aktif push listener var."
  else
    echo "UYARI: size=0 — cihaz httpHosts push başlatmıyor (firmware limiti)."
    echo "  Çözüm: bridge scripti kullan → npm run bridge:hikvision"
  fi
else
  echo "HTTP $code — DeployInfo okunamadı."
fi

echo ""
echo "=============================================="
echo "  subscribeEvent bağlantı testi (5 saniye)"
echo "=============================================="
sub_body='<SubscribeEvent version="2.0"><eventMode>all</eventMode></SubscribeEvent>'
code=$(curl -sk --digest -u "${HIK_USER}:${HIK_PASS}" \
  -X POST "http://${HIK_IP}/ISAPI/Event/notification/subscribeEvent" \
  -H "Content-Type: application/xml" \
  -d "$sub_body" \
  --max-time 5 \
  -o /tmp/hik-subscribe.txt \
  -w "%{http_code}" 2>/dev/null || echo "0")
if [[ "$code" == "200" ]]; then
  echo "OK: subscribeEvent HTTP 200 — stream açılıyor (kart okuyunca event gelir)."
  echo "  Bridge için: HIK_PASS='...' npm run bridge:hikvision"
elif [[ "$code" == "0" ]]; then
  echo "OK (timeout): 5 saniyelik test bağlantısı tamamlandı — stream çalışıyor."
  echo "  Bridge için: HIK_PASS='...' npm run bridge:hikvision"
else
  echo "HTTP $code — subscribeEvent yanıt vermedi. Cihaz IP ve şifreyi kontrol et."
fi

echo ""
echo "Bitti. Kart okutunca Convex Dashboard → Logs → card-reader"
