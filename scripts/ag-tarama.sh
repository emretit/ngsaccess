#!/bin/bash
# Ağdaki cihazları tarar: canlı IP'ler ve Hikvision (ISAPI) tespiti.
# Aynı ağdan çalıştırın (192.168.1.x). Kullanım: ./scripts/ag-tarama.sh

echo "=============================================="
echo "  192.168.1.x Ağ Taraması"
echo "=============================================="
echo ""

echo "--- Canlı IP'ler (ping) ---"
live=""
for i in $(seq 1 254); do
  (ping -c 1 -W 1 192.168.1.$i >/dev/null 2>&1 && echo "192.168.1.$i") &
done
wait 2>/dev/null
echo ""

echo "--- Hikvision (ISAPI) olan IP'ler ---"
for i in $(seq 1 254); do
  (curl -s -k -u "admin:ngs05278" --digest --connect-timeout 1 -m 2 "http://192.168.1.$i/ISAPI/System/deviceInfo" 2>/dev/null | grep -q "<model>" && echo "192.168.1.$i") &
done
wait 2>/dev/null
echo ""

echo "Bitti. Hikvision bulunan IP'lerde cihaz bilgisi için:"
echo "  curl -s -k -u admin:ngs05278 --digest http://<IP>/ISAPI/System/deviceInfo"
