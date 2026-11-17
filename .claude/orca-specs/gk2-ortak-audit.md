## Ortak bağlam (Geçiş Kontrol 2. tur, 2026-11-05)
- Uygulama: NGS Plus web, http://localhost:8081 (dev sunucusu açık, canlı Convex'e bağlı, oturum açık, aktif proje NGS).
- Sayfa /access-control 3 sekmeli: Kurallar · Yetki Durumu (?tab=status) · Kapı Planları (?tab=doors). Giriş: `src/components/access-control/unified/UnifiedAccessControl.tsx`.
- Plan: `.claude/plan-gecis-kontrol-2.md`. Kurallar sekmesi koordinatörce incelendi; sayfa başlığı sorunu (sekmeler en üstte, "Geçiş Kontrol" PageHeader yok, sekme içi küçük h1) ZATEN BİLİNİYOR → tekrar yazma.
- Soru: bu sekme sitenin geri kalanının TASARIM ve MANTIĞINA uyuyor mu? Kıyas sayfaları: Kişiler (/employees), Ziyaretçiler (/visitors), Cihazlar (/devices), Canlı İzleme (/live-monitoring), Admin (/admin: PageHeader → Tabs kalıbı).
- Site kuralları (bunlara uymayan = bulgu):
  - Ortak bileşenler `src/components/shared/`: PageHeader, FilterBar + FilterField (arama ilk; "Tüm X"; masaüstünde gizli filtre paneli yok; sonda "Filtreleri temizle"), TableStateRow (boş/yüklemede tablo başlığı kalır), StatusBadge, EmptyState, PaginationBar, RowActions, ConfirmDestructive/ConfirmAction.
  - Tablo satırı: satırın her yeri ayrıntı açar, isimde alt çizgi yok, imleç pointer (`src/lib/tableRowClick.ts`). Sütun genişliği: `Table resizeKey` + `TableHead columnId`.
  - Etiketler cümle düzeninde ("Kural adı", "Kural Adı" değil). Tarih/saat Türkiye saati. Terimler: kural / plan / kapı / cihaz / okuyucu.
  - İstisna (bulgu DEĞİL): Yetki Durumu sayaçları filtre kalıbı dışında kalabilir.
  - Tasarım dili: `docs/ui-scan/DESIGN_DIRECTION.md`, `docs/ux-audit/DESIGN_SYSTEM.md`.
- Önceki audit + kararlar: `docs/ui-audit-gk/00_OZET.md`, `03-yetki-durumu.md`, `04-kapi-planlari.md`, `sadelestirme/*.md`. Düzeltilmiş eski bulguyu tekrar yazma; "Kararlar (Emre)" uygulanmamışsa bulgu olarak yaz (kanıtla).

## Tarayıcı (Orca gömülü tarayıcı)
- Kendi sekmeni aç: `orca tab create --url "<URL>" --worktree current --json` → `result.browserPageId`. Kullanıcının ve koordinatörün sekmelerine DOKUNMA.
- HER orca komutunda `--page <id>` ver. `orca set device` KULLANMA (kullanıcının sekmesini etkiler).
- Ekran görüntüsü: `orca screenshot --page <id> --json` → `result.path` PNG dosyası → `cp` ile rapor klasörüne kopyala, aç ve bak.
- Tıklama: `orca click --element` GÜVENİLMEZ → `/tmp/orcaclick.sh <pageId> "<JS ifadesi, elemanı döndürür>"`, sonra ~1.5 sn bekle.
- Sayfa `main` içinde kayar: `orca eval --page $P --expression "document.querySelector('main').scrollTop=800"`.
- Mobil 390px: kendi sekmende `orca eval` ile body'yi `<iframe id="m" src="/access-control?tab=..." style="width:390px;height:844px">` yap; içine `document.getElementById('m').contentDocument` ile eriş.
- Bitince açtığın sekmeleri kapat: `orca tab close --page <id> --json`.

## Yasaklar (canlı veri)
- Kod/kaynak dosya DEĞİŞTİRME; yalnız kendi rapor dosyanı + ekran görüntülerini yaz.
- `git add`, `git commit`, `git stash`, `git reset`, `git checkout`, push, deploy ÇALIŞTIRMA. Convex mutation / `npx convex run` / `npx convex dev` YASAK.
- Kaydet / Sil / Gönder / Yeniden gönder / Kopyala / Uygula / "cihaza gönder" gibi veri değiştiren HİÇBİR düğmeye basma (onay dialoğunu açıp Vazgeç/Escape serbest).
- Aktif proje seçicisini değiştirme, şifre girme, dev sunucusunu yeniden başlatma.

## Rapor biçimi (Türkçe, sade; jargonu parantezle açıkla)
1. Üstte 2-3 cümle özet + Yüksek/Orta/Düşük sayı tablosu.
2. Bulgular tablosu (önemliler önce, en fazla 15): ID | önem | tür (tasarım/mantık/metin/erişilebilirlik) | ne görülüyor | sitenin geri kalanında nasıl | öneri | kanıt (`file:line` + ekran görüntüsü). Kanıtsız bulgu yazma; tahminse "doğrulanmadı".
3. "Uyumlu olanlar" (kısa liste).
4. "Hızlı düzeltmeler" (her biri ≤30 dk, dosya:satır ile).
5. "Ürün kararı gereken" (en fazla 3, her biri 2-3 seçenekli, önerilen ilk).
