# Görev B — Vardiya takvim ızgarası, ajanda ve gün penceresi görünümü (Faz 2)

**Hedef:** Hafta görünümü 1231×775 pencerede (içerik alanı ~934 px) yatay kaydırmasız sığar; boş hücreler sade, bugün ve hafta sonu ayırt edilir, başlıkta "tümünü seç" var, ay görünümü kompakt.

**Ownership (yalnız bunlara yaz):**
- src/components/shifts/ShiftCalendarGrid.tsx (CalendarProps'a koordinatör `canAssign?` ve `selectAll?` ekledi — imzayı KORU, başka zorunlu prop ekleme)
- src/components/shifts/ShiftCalendarCell.tsx
- src/components/shifts/ShiftAgendaView.tsx
- src/components/shifts/ShiftDayDetails.tsx
- src/components/shifts/lib/planning.ts (yalnız yeni yardımcı eklemek için; mevcut export'ları değiştirme)
- yeni test: src/components/shifts/calendarGrid.test.tsx (ve gerekirse src/components/shifts/lib/calendarPresentation.test.tsx)

**Yapılacaklar:**
1. V-O4: Hafta: çalışan sütunu ~176 px, gün sütunu ≥ ~104 px; tablo minWidth hafta için ≤ 934 px olsun. Ad altındaki e-posta satırını kaldır (e-postayı ad span'ının `title`'ına koy). Ay (>7 gün): gün sütunu ~56–64 px.
2. V-O12: Ay görünümünde hücre kompakt: yalnız saat aralığı tek satır (ör. "08:30–18:00"; esnekte "Esnek"), vardiya adı `title`'da; min yükseklik ~40 px; rozetler (izin/tatil/çakışma) kısaltılmış tek nokta/kısa etiket olabilir ama aria-label tam bilgiyi taşısın. Hafta görünümünde mevcut ad + saat kalır.
3. V-O5: Boş hücrede "Atama yok" yazısı GÖRÜNMESİN (erişilebilir ad buton aria-label'ında kalır). `canAssign` true ise boş hücrede hover/focus'ta ortada muted "+" görünsün ve aria-label "…, atama yok, vardiya ata" olsun; false ise "…, atama yok, günü aç". Bugün sütunu: başlık ve hücreler hafif bordo ton (ör. bg-primary/5) + başlıkta gün kalın; "Bugün" kelimesi ikinci satıra kırılmasın (sr-only kalabilir). Cumartesi/Pazar ve tatil günü sütunları hafif gri ton (bg-subtle/60 vb.). Başlık etiketi "Pzt 19" biçimi (shortDayLabel'ı gerekirse yeni yardımcıyla değiştir).
4. V-O11: `selectAll` verilmişse "Çalışan" başlık hücresinde native checkbox (accent-primary, size-5/6), `indeterminate` ref ile; aria-label "Görünen tüm çalışanları seç". Ajandada listenin üstünde aynı kutu ("Tümünü seç").
5. V-D1: "Diğer günler için takvimi yatay kaydırın." ipucu yalnız gerçekten taşınca (mevcut ölçüm) — hafta görünümünde artık çıkmamalı.
6. V-O6 + V-D3 (ShiftDayDetails): DialogDescription'a sağ boşluk (×'in altına girmesin, ör. pr-8); üstte tekrar eden ShiftCalendarCell yerine yalnız rozetler (izin/tatil/çakışma) kalsın, kayıt listesi aynı; "Bu tarihe vardiya ata" ve diğer düğmeler tam genişlik değil, sağa hizalı DialogFooter'da.
7. Mobil ajanda: kişi satırı kompakt (ad + hücre aynı satırda olabilir), checkbox min dokunma 44 px korunur.

**Kapsam dışı:** ShiftCalendarPlan/CalendarHeader/CalendarNavigation (A — onlar `canAssign`/`selectAll` prop'larını geçirecek), tanımlar/renk (C). Vardiya rengi hücreye SONRA koordinatör tarafından eklenecek; sen ekleme.
**Kabul:** tsc 0 (senin dosyaların), eslint temiz, `npx vitest run src/components/shifts` yeşil; yeni testler: boş hücrede "Atama yok" metni yok + canAssign'a göre aria-label, selectAll indeterminate/checked, hafta tablosu minWidth ≤ 934, bugün sütunu işaretli.
