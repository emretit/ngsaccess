06-H1 → Tüm projede filtre, cursor ve zaman aralığı indexleri; ileri taşınmış expired + sınır + cursor testleri: convex/visitors.ts:157.
06-O1/O2 → Dakika/1 sn polling kalktı; visitEnd türetimi, yalnız sonraki bitişte yenileme; dört tam sayaç, 500 sınırı/N+1 yok: hooks/useVisitorClock.ts:8, VisitorStats.tsx:8, convex/visitors.ts:204.
06-O3 → Yalnız kart yeteneği bilinen aktif cihazlar; marka/tip etiketi: VisitorCardCapture.tsx:33, lib/readerCapability.ts:10.
06-O5 → Metin uydurulmadı; ayar URL/sürüm okuma, boş durum, onaylanan sürüm snapshot ve sürüm yarışında ret: VisitorFormFields.tsx:45, convex/visitors.ts:39 (ayar yazımı sonraki dalgada koordinatörde).
06-O6/O7 → Sentetik e-posta gizli; Erişim üstte, ad/soyad yan yana, yerel erişilebilir A2 açılır bölüm: VisitorSlideOverPanel.tsx:76, VisitorFormFields.tsx:25, VisitorCollapsible.tsx:5.
06-D1/D2/D4 → Boş sayfalayıcı/ikinci kayıt CTA yok, eski sync tarihi gizli, boş değerler tutarlı: VisitorManagement.tsx:48/76, VisitorTable.tsx:25, VisitorSlideOverPanel.tsx:63.
06-D5/D6/D7 → Bölge adı *, kapısız seçim pasif; hata çerçevesi; src/mobile çağıranı olmayan list silindi ve ücret testleri listPage oldu: VisitorZoneDialog.tsx:98/110, VisitorCombobox.tsx:14, convex/visitors.ts:157.
06-O4/06-D3 → Sayfada kullanılan gerçek TimeSchedule seçili gün stili ve görünür FilterBar etiketleri SSR ile doğrulandı: visitorAudit.test.tsx:49; form tek adımlı kaldı.
Kapılar → Hedef ESLint 0 error/0 warning; kapsam + ilgili ortak testler 10 dosya/96 test yeşil; değiştirilen dosyalarda diff-check temiz.
Dış kapılar → tsc 7 hata: convex/lib/privacyFixes.test.ts, convex/orphanGuards.test.ts, src/components/pdks/chat/{OpenAiKeyInput,useAiChat,useModelStatus}.ts(x); tam Vitest 84 dosya, 1351 geçti/37 dış hata (orphanGuards 36 + privacyFixes 1), 0 ziyaretçi hatası; koordinatör dış hataları kabul etti.
