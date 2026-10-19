# Görev (SALT OKUMA denetim): PDKS Faz 0 değişikliklerini denetle

Repo: /Users/emreaydin/ngsaccess. Kodu Codex worker'ları yazdı; sen bağımsız denetçisin. HİÇBİR dosyayı düzenleme.

## Kapsam
`git diff HEAD -- convex src` (+ yeni dosyalar: convex/lib/trDate*.ts, convex/lib/breakDeduction.test.ts, convex/lib/sgkEksikGun*.ts). Önceden var olan ve bu işe ait OLMAYAN değişiklikler: convex/lib/cardReadingAudit.ts, mobile/* — bunları yok say.

Faz 0 hedefleri (docs/PDKS_AUDIT_VE_PLAN_2026-10-16.md §3 P2-P6):
- P4 `createCheckInToken` silindi, başka çağıran yok.
- P6 md. 68: ≤4 sa 15 dk, 4–7,5 sa (dahil) 30 dk, >7,5 sa 60 dk.
- P5 accessTime gün anahtarı ve sorgu aralıkları TR (UTC+3) — kalan `split("T")[0]` kullanımları var mı (sgkExport dahil)?
- P2/P3 SGK kodları resmi listeyle uyumlu; hafta tatili/UBGT/ücretli izin eksik gün değil; proje kapsamı ve yetki denetimi korunmuş.

## Kontrol et
1. Doğruluk: sınır değerleri, TR gün dönümü (21:00Z), ay sonu/yıl dönümü, boş veri.
2. Güvenlik: yetki/proje kapsamı gevşedi mi; public fonksiyon yüzeyi (api.d.ts diff) beklenmedik değişti mi.
3. Golden test beklentilerinde yapılan değişiklikler gerekçeli ve doğru mu (yanlış davranışı "yeşil" yapmak için mi değiştirildi?).
4. R8 (3 ekran farklı hesap) bilerek korundu mu.
5. Kapıları KENDİN koş: tsc (app+convex), eslint src convex, npx vitest run.

## YASAK
Dosya düzenleme, commit, push, deploy, canlı DB.

## Rapor
worker_done özetinde ≤10 satır: bulgu başına [ciddiyet] file:line — sorun — öneri; sonunda kapı sonuçları. Bulgu yoksa "temiz" de.
