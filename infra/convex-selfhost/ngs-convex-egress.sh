#!/usr/bin/env bash
# NgAccess self-host Convex — backend konteynerinin dışarı çıkış kısıtı.
# Yalnız br-ngscvx-egr köprüsünden (ngs-convex_egress ağı, 172.30.210.0/24) gelen trafiğe uygulanır;
# diğer konteynerler ve host trafiği etkilenmez. Fail-closed: zincir boş/yarım kalsa da sondaki DROP tutar.
#   apply  : zincirleri kur/güncelle (idempotent; timer her 2 dk çağırır)
#   remove : tüm kuralları kaldır (geri alma)
#   status : kuralları ve sayaçları göster
set -euo pipefail
BR=br-ngscvx-egr
FWD=NGS-CVX-FWD          # DOCKER-USER (FORWARD) -> internete giden
IN=NGS-CVX-IN            # INPUT -> host'un kendi portlarına (gateway :8088, nginx :443)
HOST_IP=157.90.114.86
SMTP_PORTS=465,587
MAIL_API_HOSTS="api.resend.com"
IPT=iptables

resolvers() { awk '/^nameserver/ && $2 ~ /^[0-9.]+$/ {print $2}' /run/systemd/resolve/resolv.conf 2>/dev/null; }
resolve4() { getent ahostsv4 "$1" 2>/dev/null | awk '{print $1}' | sort -u; }

desired_fwd() {
  echo "-A $FWD -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT"
  for r in $(resolvers); do
    echo "-A $FWD -d $r/32 -p udp -m udp --dport 53 -j ACCEPT"
    echo "-A $FWD -d $r/32 -p tcp -m tcp --dport 53 -j ACCEPT"
  done
  echo "-A $FWD -p tcp -m multiport --dports $SMTP_PORTS -j ACCEPT"
  local ips=""
  for h in $MAIL_API_HOSTS; do ips="$ips $(resolve4 "$h")"; done
  if [ -z "${ips// /}" ]; then
    # DNS geçici olarak yanıt vermezse mevcut mail API IP'lerini koru.
    $IPT -S "$FWD" 2>/dev/null | grep -- '--dport 443 ' || true
  else
    for ip in $ips; do echo "-A $FWD -d $ip/32 -p tcp -m tcp --dport 443 -j ACCEPT"; done
  fi
}

desired_in() {
  echo "-A $IN -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT"
  echo "-A $IN -d $HOST_IP/32 -p tcp -m tcp --dport 8088 -j ACCEPT"   # Hik gateway
  echo "-A $IN -d $HOST_IP/32 -p tcp -m tcp --dport 443 -j ACCEPT"    # nginx: site./api. (JWKS) + relay.ngsplus.app
}

sync_chain() { # $1=chain $2=desired-rules
  local cur
  cur=$($IPT -S "$1" | grep -v -- "^-N $1$" || true)
  if [ "$cur" != "$2" ]; then
    $IPT -F "$1"
    while IFS= read -r rule; do [ -n "$rule" ] && $IPT $rule; done <<< "$2"
    logger -t ngs-convex-egress "updated $1 ($(echo "$2" | grep -c .) rules)"
  fi
}

ensure_pair() { # $1=chain $2=target : zincirin ilk iki kuralı [-i BR -j target, -i BR -j DROP] olmalı
  local chain=$1 target=$2 want got n
  want="-A $chain -i $BR -j $target
-A $chain -i $BR -j DROP"
  got=$($IPT -S "$chain" | grep '^-A ' | head -2 || true)
  [ "$got" = "$want" ] && return 0
  $IPT -I "$chain" 1 -i "$BR" -j DROP            # önce kapat (fail-closed)
  # 1. satır (yeni DROP) dışındaki tüm -i BR kurallarını sondan başa sil
  for n in $( { $IPT -S "$chain" | grep '^-A ' || true; } | awk -v br="$BR" '{for(i=1;i<=NF;i++) if($i=="-i" && $(i+1)==br){print NR; break}}' | sort -rn); do
    [ "$n" -gt 1 ] && $IPT -D "$chain" "$n"
  done
  $IPT -I "$chain" 1 -i "$BR" -j "$target"
  logger -t ngs-convex-egress "repaired jump pair in $chain"
}

apply() {
  $IPT -N DOCKER-USER 2>/dev/null || true
  $IPT -N "$FWD" 2>/dev/null || true
  $IPT -N "$IN" 2>/dev/null || true
  ensure_pair DOCKER-USER "$FWD"
  ensure_pair INPUT "$IN"
  sync_chain "$FWD" "$(desired_fwd)"
  sync_chain "$IN" "$(desired_in)"
}

remove() {
  while $IPT -D DOCKER-USER -i "$BR" -j "$FWD" 2>/dev/null; do :; done
  while $IPT -D DOCKER-USER -i "$BR" -j DROP 2>/dev/null; do :; done
  while $IPT -D INPUT -i "$BR" -j "$IN" 2>/dev/null; do :; done
  while $IPT -D INPUT -i "$BR" -j DROP 2>/dev/null; do :; done
  $IPT -F "$FWD" 2>/dev/null && $IPT -X "$FWD" || true
  $IPT -F "$IN" 2>/dev/null && $IPT -X "$IN" || true
}

status() {
  $IPT -S DOCKER-USER; $IPT -S INPUT | grep -- "$BR" || true
  $IPT -L "$FWD" -v -n 2>/dev/null; $IPT -L "$IN" -v -n 2>/dev/null
}

case "${1:-}" in apply) apply ;; remove) remove ;; status) status ;; *) echo "usage: $0 apply|remove|status" >&2; exit 2 ;; esac
