#!/usr/bin/env bash
# Convex /card-reader endpoint'ini farklı payload formatlarıyla test eder.
# Kullanım: bash scripts/test-convex-endpoint.sh [CONVEX_URL]
# Örnek:    bash scripts/test-convex-endpoint.sh https://notable-tern-4.convex.site

set -euo pipefail

CONVEX_URL="${1:-${CONVEX_CARD_READER_URL:-https://notable-tern-4.convex.site}}"
ENDPOINT="$CONVEX_URL/card-reader"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

pass=0
fail=0

run_test() {
  local name="$1"
  local method="$2"
  local content_type="$3"
  local body="$4"
  local expect_http="${5:-200}"

  printf "  %-55s " "$name"

  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" "$ENDPOINT" 2>/dev/null)
  else
    response=$(curl -s -w "\n%{http_code}" \
      -X POST "$ENDPOINT" \
      -H "Content-Type: $content_type" \
      -d "$body" 2>/dev/null)
  fi

  http_code=$(echo "$response" | tail -1)
  body_out=$(echo "$response" | sed '$d')

  if [ "$http_code" = "$expect_http" ]; then
    echo -e "${GREEN}✓ $http_code${NC}"
    echo "    $body_out" | head -2
    pass=$((pass + 1))
  else
    echo -e "${RED}✗ HTTP $http_code (beklenen: $expect_http)${NC}"
    echo "    $body_out" | head -2
    fail=$((fail + 1))
  fi
}

echo ""
echo "Convex Card Reader Endpoint Testleri"
echo "Endpoint: $ENDPOINT"
echo "────────────────────────────────────────────────────────────"

# 1. Health check
run_test "GET /card-reader (health check)" GET "" "" 200

# 2. Nested AccessControllerEvent JSON
run_test "POST – nested AccessControllerEvent JSON" POST "application/json" \
  '{"EventNotificationAlert":{"ipAddress":"192.168.1.34","macAddress":"aa:bb:cc:dd:ee:ff","AccessControllerEvent":{"cardNo":"TEST001","employeeNoString":"1","majorEventType":5,"subEventType":75,"doorNo":1}}}' \
  200

# 3. Flat JSON
run_test "POST – flat JSON (cardNo + ipAddress)" POST "application/json" \
  '{"cardNo":"TEST001","ipAddress":"192.168.1.34"}' \
  200

# 4. Farklı card field: employeeNoString
run_test "POST – employeeNoString field" POST "application/json" \
  '{"employeeNoString":"EMP42","ipAddress":"192.168.1.34"}' \
  200

# 5. Farklı card field: cardNumber
run_test "POST – cardNumber field" POST "application/json" \
  '{"cardNumber":"CARD99","serialNumber":"SN-001"}' \
  200

# 6. XML payload
run_test "POST – XML payload" POST "application/xml" \
  '<?xml version="1.0"?><EventNotificationAlert><ipAddress>192.168.1.34</ipAddress><AccessControllerEvent><cardNo>XML001</cardNo><serialNumber>SN-XML</serialNumber></AccessControllerEvent></EventNotificationAlert>' \
  200

# 7. Geçersiz payload → 200 + reddedildi beklenir (endpoint hata vermez)
run_test "POST – geçersiz/boş payload (200 beklenir)" POST "application/json" \
  '{}' \
  200

# 8. macAddress serial fallback
run_test "POST – macAddress serial fallback" POST "application/json" \
  '{"EventNotificationAlert":{"ipAddress":"192.168.1.34","macAddress":"11:22:33:44:55:66","AccessControllerEvent":{"cardNo":"MAC001"}}}' \
  200

echo ""
echo "────────────────────────────────────────────────────────────"
echo -e "Sonuç: ${GREEN}${pass} geçti${NC}  ${RED}${fail} başarısız${NC}"
echo ""

if [ $fail -gt 0 ]; then
  exit 1
fi
