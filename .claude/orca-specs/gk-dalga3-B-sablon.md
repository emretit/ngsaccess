# Geçiş Kontrol Dalga 3 — B: Zaman şablonu editörü saat alanları

## Hedef
Şablon editöründe her saat alanının ne olduğu (Başlangıç/Bitiş) ve hatanın hangi gün/aralıkta olduğu alanın hemen yanında, ekran okuyucuya bağlı biçimde görünür.

## Ownership (yalnız bunlar; testleri dahil)
- src/components/access-control/unified/templates/TemplateEditor.tsx, WeekPreview.tsx, schedule.ts (+ templates.test.tsx, schedule.test.ts)
- Editörün kullandığı saat aralığı bileşeni unified/templates/ altındaysa o da; unified/components/ altındaysa (ör. TimeSchedule.tsx) DUR ve ask (A/C1 ile çakışabilir).
Kapsam dışı: TemplatePicker.tsx, TemplatesPage.tsx metinleri (Dalga 2 bitti), status/, rules-list/, door-*.

## İstenenler
1. **02-O4:** Saat kutularına görünür "Başlangıç" / "Bitiş" etiketi (mobilde de), biçim örneği (`22:00`; bitiş en fazla `24:00`).
2. Hata, ilgili gün/aralık satırının hemen altında ("Pazartesi 2. aralık: bitiş 24:00'ü geçemez" gibi); alanda `aria-invalid` + `aria-describedby` hata metnine bağlı. Genel (hafta altı) hata özeti kalabilir ama alan hatasının yerine geçmez.
3. Geceye taşan aralık açıklaması ilgili satıra yakın gösterilir.

## Kabul
- Test: geçersiz bitiş (25:00) girilince o satırın altında gün/aralık adıyla hata ve input'ta aria-invalid=true + aria-describedby hata id'sine eşit.
- Test: Başlangıç/Bitiş etiketleri input'larla ilişkili (label/aria-label).
- Mevcut templates/schedule testleri yeşil.
