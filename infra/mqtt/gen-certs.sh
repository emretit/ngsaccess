#!/usr/bin/env bash
# NGS Access — Mosquitto self-signed CA + server sertifikası üretir.
#
# Panel SSL_SELF_SIGNED=1 ile bağlanır (zinciri doğrulamaz), ama TLS handshake için
# geçerli bir sunucu sertifikası gerekir. Bridge daemon ise CA'yı tanıyıp tam doğrulama yapar.
#
# Domain yok → CN/SAN olarak sunucu IP'si kullanılır.
# Kullanım (Hetzner'da, infra/mqtt/ içinde):
#   BROKER_IP=157.90.114.86 ./gen-certs.sh
set -euo pipefail

BROKER_IP="${BROKER_IP:-157.90.114.86}"
DAYS="${DAYS:-3650}"
OUT="${OUT:-./certs}"

mkdir -p "$OUT"
cd "$OUT"

if [ -f server.crt ] && [ "${FORCE:-0}" != "1" ]; then
  echo "certs/ zaten dolu (FORCE=1 ile üzerine yaz). Çıkılıyor."
  exit 0
fi

echo "[gen-certs] CA üretiliyor..."
openssl genrsa -out ca.key 4096
openssl req -x509 -new -nodes -key ca.key -sha256 -days "$DAYS" \
  -subj "/CN=NGS-Access-MQTT-CA/O=NGS" -out ca.crt

echo "[gen-certs] Server key + CSR (CN=$BROKER_IP)..."
openssl genrsa -out server.key 2048
openssl req -new -key server.key \
  -subj "/CN=$BROKER_IP/O=NGS" -out server.csr

# SAN — hem IP hem (ileride domain eklenebilir).
cat > server.ext <<EOF
subjectAltName = IP:$BROKER_IP
extendedKeyUsage = serverAuth
EOF

echo "[gen-certs] Server cert CA ile imzalanıyor..."
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out server.crt -days "$DAYS" -sha256 -extfile server.ext

chmod 600 ca.key server.key
rm -f server.csr server.ext ca.srl

echo "[gen-certs] Bitti. Üretilenler:"
ls -la ca.crt server.crt server.key
echo "[gen-certs] ca.crt'yi bridge daemon'a ver (rejectUnauthorized:true için)."
