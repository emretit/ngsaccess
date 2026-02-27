#!/bin/bash
# Convex card-reader endpoint'ini curl ile test scripti
# Kullanım: ./scripts/test-card-reader-curl.sh

URL="${CARD_READER_URL:-https://notable-tern-4.convex.site/card-reader}"
# Cihaz 192.168.1.212 - DS-K1T343MFWX
SERIAL="${DEVICE_SERIAL:-DS-K1T343MFWX20240702V032100ENFT9649880}"
CARD_NO="${CARD_NO:-12345678}"

echo "=== Convex card-reader test ($URL) ==="
echo "  Serial: $SERIAL | Card: $CARD_NO"
echo ""

echo "1. user_id + serial:"
curl -s -w "\n   HTTP: %{http_code}\n" -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"$CARD_NO\",\"serial\":\"$SERIAL\"}"
echo ""

echo "2. cardNo + serialNumber (Hikvision):"
curl -s -w "\n   HTTP: %{http_code}\n" -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d "{\"cardNo\":\"$CARD_NO\",\"serialNumber\":\"$SERIAL\"}"
echo ""

echo "3. EventNotificationAlert wrapper:"
curl -s -w "\n   HTTP: %{http_code}\n" -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d "{\"EventNotificationAlert\":{\"cardNo\":\"$CARD_NO\",\"serialNumber\":\"$SERIAL\"}}"
echo ""

echo "---"
echo "Beklenen: HTTP 200, body {\"cevap\":\"ok\"} veya {\"cevap\":\"error\"} (cihaz/çalışan/grup yoksa error)."
echo "npx convex dev açık olmalı."
