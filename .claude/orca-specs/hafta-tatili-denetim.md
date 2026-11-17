# Denetim — Hafta tatili vardiya planından (SALT OKUMA)

## Hedef (test edilebilir)
`/tmp/hafta-tatili-denetim.md` dosyasında W1+W2+W3 diff'inin plan sözleşmesine uyup uymadığı ENGEL / DÜZELTİLMELİ / NOT
etiketli, file:line kanıtlı bulgularla raporlansın; plan "Kabul testleri" 1–8'in her biri için hangi testin kanıtladığı yazılsın.

## Bağlam
- Plan: `.claude/plan-calisma-gunleri-vardiya.md` (Tasarım + W1/W2/W3 + Kabul testleri). Kararlar: K1 haftalık planda seçilmeyen
  gün her zaman hafta tatili; K2 tatil gününde çalışma atanmış vardiyanın kurallarıyla.
- Uygulama sırasında koordinatör kararları (plana göre değişiklik):
  1. Rapor keşfi değişikliği UYGULANMADI: legacy rapor yolu korunur, eski raporların sayıları değişmemeli.
  2. DayPlan'e `origin: 'weekly'|'cycle'` eklendi; `usesPlanDayRules` haftalık tekli günü eski sıradan yolda tutar.
  3. Plandaki "rest'te attendanceDecision silinir" maddesi geri alındı: tekli bağlam vardiyasında decision kalır.
  4. Test beklentileri değiştirilmedi; yalnız fixture'lar (boş weekPattern → MON..FRI, origin alanı, DayPlan tipi) uyarlandı.
- Worker raporları: `/tmp/hafta-tatili-W1-rapor.md`, `/tmp/hafta-tatili-W2-rapor.md`, `/tmp/hafta-tatili-W3-rapor.md`.
- Diff: `git diff 1b1be4ee -- convex src` (commit'siz çalışma ağacı). Raporu değil DIFF'i oku.

## Özellikle bak
1. Test beklentisi (assert/expect sayısı) değişmiş mi? `git diff 1b1be4ee -- '*.test.ts' '*.test.tsx' '*.snap'` içinde
   fixture dışı beklenti değişikliği varsa ENGEL.
2. Canlı eşdeğerlik: "Her gün" haftalık atama + migration sonrası MON..FRI → Cumartesi/Pazar hesabı eskiyle aynı mı
   (bağlam vardiyası, mola, FM açık/kapalı, gece, holidayWorkRequired, attendanceDecision).
3. splitAtMidnight `nextDayKind` doğru mu; `shiftStart` modunda davranış aynı mı.
4. SGK `restDays`: plansız gün kuralı korunmuş mu (`sgkExport.ts`), döngü rest günü eksik gün sayılmıyor mu.
5. Migration (`convex/migrations.ts`): idempotent, `updatedAt` değişmiyor, kişi + departman satırları, Türkçe→kod eşlemesi,
   projectId'siz satır, dryRun yazmıyor.
6. Boş weekPattern yazım reddi backend'de ve UI'da tutarlı mı; eski boş satırlar okunurken çökme yok mu.
7. Güvenlik/yetki: kaldırılan `getWorkingDays`/`saveWorkingDays` başka yerde çağrılıyor mu (src dahil); yeni sorgu yetki
   kontrolü atlıyor mu.
8. CLAUDE.md kuralları: any/as any, `!` non-null, snake_case yok.

## Yasaklar
- Hiçbir dosyayı değiştirme (rapor dosyası hariç). `git add/commit/stash/reset/checkout/restore` YOK.
- `npx convex dev|deploy|run|import` YOK, DB yazma YOK.
- Test koşmak serbest (okuma amaçlı): `node_modules/.bin/vitest run <dosya>`.

## Rapor
- `/tmp/hafta-tatili-denetim.md`: başta 3 satır sonuç (yayına engel var mı), sonra bulgular, sonra Kabul 1–8 eşlemesi.
- `worker_done` özeti ≤10 satır, file:line.
