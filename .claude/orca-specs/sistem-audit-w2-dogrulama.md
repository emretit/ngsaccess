# SİSTEM AUDIT — DALGA 2A: P0/P1 BULGU DOĞRULAMA (bağımsız denetçi)

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/sistem-audit-ortak.md` dosyasındaki **YASAK** listesini oku; aynen geçerli
(rapor dışında dosya yazma yok, git add/commit/stash/checkout/reset yok, npx convex yok, DB/Supabase yok, ağ/cihaz yok).

**Rapor:** `docs/sistem-audit-2026-10-25/DOGRULAMA.md` (yalnız bu dosyayı yazabilirsin).

## Görev
Dalga 1'de 5 Codex worker modül raporu yazdı: `docs/sistem-audit-2026-10-25/M{1..5}-*.md`. Sen bağımsız denetçisin: raporlara
GÜVENME, her bulguyu KODDAN yeniden kanıtla. Kapsam: tüm raporlardaki **P0 ve P1** bulgular (K-/C-/P-/Y-/B- önekli) +
aşağıdaki koordinatör maddeleri. P2/P3'e bakma.

Koordinatör maddeleri (bunları da doğrula, ID `X-`):
- X-01 `convex/actions/sendEmail.ts:141` sendEmployeeSetupEmail: `employees.view` yetkili (viewer/security/technician) kullanıcı istemci
  verdiği e-postaya setup token yollatıp çalışanın mobil hesabını devralabilir (M4 raporunda da olabilir; tek satırda birleştir).
- X-02 Mobil 1.0.5 (commit 5de547a8) PDKS düzeltme talebi gönderiyor; web yönetici kuyruğu bb7d942a'da silindi; `src` içinde
  `attendanceCorrections` tüketicisi yok → talepler hiçbir yöneticiye görünmüyor.

## Her bulgu için
1. Raporun gösterdiği file:line'ı aç; çağrı zincirini uçtan uca izle (UI → Convex fn → yetki kontrolü → yazma/yan etki).
2. Önkoşulları yaz (hangi rol, hangi veri durumu). Bulguyu çürüten bir koruma (başka katmanda kontrol, index, validator, UI dışı engel) ara.
3. Karar: **DOĞRU** (kodda kanıtlı) / **KISMEN** (doğru ama önem/kapsam abartılı veya önkoşul dar) / **YANLIŞ** (koruma var — kanıtla) /
   **DOĞRULANAMADI** (canlı/cihaz gerekir).
4. Önem önerisi: raporun önemi doğru mu? (P0→P1 indirme veya P1→P0 yükseltme gerekçesiyle.)
5. Düzeltme önerisi en fazla 2 satır + emek (S ≤2 sa / M ≤1 gün / L >1 gün) + birlikte düzeltilmesi gereken bulgu ID'leri (aynı kök neden).

## Rapor biçimi (Türkçe, sade, ≤ 300 satır)
1. **Sonuç (2-3 cümle)** + sayım: DOĞRU / KISMEN / YANLIŞ / DOĞRULANAMADI; önem değişiklikleri.
2. **Tablo:** `ID | Rapor önemi | Karar | Önerilen önem | Önkoşul (kim/ne durumda) | Kanıt (file:line, 1 cümle) | Düzeltme + emek | Birlikte düzelt`
3. **Kök neden kümeleri:** aynı düzeltmeyle kapanacak bulgu grupları (örn. "yetki kontrolü giriş noktaları arasında tutarsız: K-01, K-03, K-06, Y-..").
4. **Hemen (canlıda istismar edilebilir) listesi:** en fazla 5 madde, öncelik sırasıyla.

`worker_done` ≤10 satır: sayım, en kritik 3 madde (file:line), rapor yolu, `--outcome succeeded`.
