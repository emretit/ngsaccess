#!/bin/bash

# Kart okuyucu test betiği
# Kullanım: ./test-card-reader.sh <kart_no> <cihaz_id>

# Varsayılan değerler
CARD_NO=${1:-"12345678"}
DEVICE_ID=${2:-"TERMINAL001"}
API_URL=${API_URL:-"http://localhost:3001/api/card-reader"}
API_KEY=${API_KEY:-"test-api-key"}

echo "🔑 Kart okuyucu API testi başlatılıyor..."
echo "📡 API URL: $API_URL"
echo "💳 Kart No: $CARD_NO"
echo "🔌 Cihaz ID: $DEVICE_ID"

# JSON veri oluştur
JSON_DATA=$(cat <<EOF
{
  "card_no": "$CARD_NO",
  "device_id": "$DEVICE_ID",
  "ip_address": "192.168.1.100",
  "location": "Test Lokasyonu"
}
EOF
)

echo "📤 Gönderilen veri:"
echo "$JSON_DATA" | jq . 2>/dev/null || echo "$JSON_DATA"

# API isteği gönder
echo "🔄 İstek gönderiliyor..."
RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "$JSON_DATA" \
  "$API_URL")

echo "📥 Alınan yanıt:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"

# Yanıtı kontrol et
if echo "$RESPONSE" | grep -q "open_relay"; then
  echo "✅ Test başarılı: Kapı açıldı"
else
  echo "❌ Test başarısız: Kapı açılmadı"
fi 