# W4.1b DENETİM — Zaman şablonları arayüzü (SALT-OKUMA)

Çalışma dizini: `/Users/emreaydin/orca/workspaces/ngsaccess/w4-1-schedule-templates` — İLK İŞ `cd` oraya. Arayüz farkı = `src/**` değişiklikleri (`git status --short src`). Aynı ağaçta commit'siz W4.1a backend de var (`convex/**`, ayrıca denetlendi — kapsam dışı, yalnız API'yi anlamak için oku). Yazan: Codex. Spec: `/Users/emreaydin/ngsaccess/.claude/orca-specs/w4-1b-schedule-templates-ui.md` (+ sonradan eklenen: previewImpact yalnız Kaydet'te tek sefer; SyncRuns 'Şablon gönderimi'). Yazar raporu: `/tmp/w41b-report.md`. API: `/tmp/w41a-api.md`.

## YASAK
Kod/dosya düzenleme (rapor dosyası hariç), commit, push, deploy, `npx convex *`, DB yazma, paket kurma.

## Odak
1. **Yanlış kayıt riski:** sihirbazda mod geçişi → gönderilen payload doğru mu (şablon modunda `scheduleTemplateId`, Özel'e dönüşte önceden şablonluysa `null`, hiç şablonu olmayan kuralda alan gönderilmiyor/`undefined`); gömülü gün/saat korunuyor mu; düzenlemede şablonlu kural doğru modda açılıyor mu; zod şeması şablon modunda gün/saat zorunluluğunu kaldırıp `scheduleTemplateId`'yi zorunlu tutuyor mu.
2. **Editör doğruluğu:** aralık ekle/sil, gün başına 8, `24:00`, gece bölme (`splitOvernight`), normalize önizleme backend'in `normalizeWeek`'i ile aynı (kopya mantık var mı — `templates/schedule.ts` ne yapıyor, `convex/lib/accessSchedule.ts`'i mi import ediyor?), boş hafta uyarısı, ✓/✗ satırı.
3. **Kaydet akışı:** previewImpact yalnız Kaydet'te tek seferlik (reaktif abonelik/tuş başına çağrı yok), ideOverLimit doluyken kaydet pasif, backend hata metni gösteriliyor.
4. **Yetki:** `isAdmin=false`'ta tüm yazma aksiyonları (Yeni/Düzenle/Kopyala/Arşiv/Sil, sihirbazdaki "Şablonu düzenle") gizli/pasif.
5. **Repo kuralları:** `any`/`as any`/`!` yok; Convex sonuçları `FunctionReturnType`/`useQuery` tipiyle; `filter(Boolean)` yerine tip korumalı; Türkçe metin; 360 px'de taşma riski (sabit genişlik, `min-w`, tablo).
6. **Reaktif maliyet:** liste/picker'da gereksiz `useQuery` aboneliği (her satır için ayrı query vb.).

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/eslint src convex` · `node_modules/.bin/vitest run src` (sayı) · `node_modules/.bin/vite build`.

## Rapor
`/tmp/w41b-denetim.md`: 1-2 cümle sonuç · kapılar · ENGEL / DÜZELTİLMELİ / NOT (file:line + senaryo + öneri). `worker_done`'da ≤10 satır özet + yol.
