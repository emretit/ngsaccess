# Denetim — KVKK Faz 1 FRONTEND (salt-okuma)
Repo: /Users/emreaydin/ngsaccess (değişiklikler commit'siz; `git status`, `git diff`, untracked dosyaları doğrudan oku). ÖNCE `CLAUDE.md`, `docs/ui-scan/DESIGN_DIRECTION.md`, `docs/ux-audit/DESIGN_SYSTEM.md`.
Bağlam: `.claude/orca-specs/kvkk1-common.md` + worker raporları `.claude/orca-specs/reports/kvkk1-{biometric,biometric-destruction,retention-assistant}.md`.
RAPORLARA GÜVENME: kodu kendin oku, kendi koştuğun komutla doğrula. Kodu DEĞİŞTİRME, commit/deploy/giriş/canlı veri YOK. Yazacağın tek dosya raporun.
NOT: `tsc -p tsconfig.app.json` landing/demo dosyalarında başka oturumun yarım işinden hata verebilir; yalnız KVKK dosyalarını süz.

## Kapsam (frontend)
`src/components/settings/sections/PrivacySettings.tsx`, `src/components/settings/sections/privacy/*` (3 kart + testleri), `src/components/settings/SettingsSidebar.tsx`, `src/pages/Settings.tsx`, `src/lib/capabilities.ts(+test)`,
`src/components/employees/EmployeeConsentsCard.tsx`, `src/lib/consentNotice.ts`, `src/components/pdks/chat/hooks/useMessageHandler.ts` (+ projectId akışı), ilgili `convex/*` public imzaları (çağrı uyumu için).

## Kontrol listesi (kanıt: dosya:satır)
1. **Doğruluk**: her kart doğru query/mutation'ı doğru argümanla çağırıyor mu (imzaları backend dosyalarından karşılaştır)? Hata kodları (`BIOMETRIC_DISABLED`, `BIOMETRIC_MODULE_ACTIVE`, `BIOMETRIC_DESTRUCTION_ACTIVE` vb.) kullanıcıya anlaşılır Türkçe mesajla gösteriliyor mu? Yükleme/boş/hata durumları? Proje değişiminde durum sıfırlanıyor mu?
2. **Yıkıcı akış (imha kartı)**: sayım yapılmadan, proje adı/gerekçe yanlışken, modül açıkken, işlem sürerken düğme gerçekten kapalı mı? Çift tıklama, sayfa yenileme sonrası son run durumu, ilerleme/tutanak gösterimi doğru mu? "Silindi" demesi gereken yerde köprü cihazları için YANILTICI başarı mesajı var mı (DS-K2804 cihazdan silmiyor; cihazDogrulanamayan gösterilmeli)?
3. **Metin/hukuki ton**: "KVKK'ya uygundur", "yasal olarak güvenli" gibi kesin hukuki iddia var mı? Danışman doğrulama notu var mı? `consentNotice.ts` taslağı eksik/yanıltıcı alan içeriyor mu? `EmployeeConsentsCard`'ta biyometriyi PDKS/mesai gerekçesi olarak sunan kalıntı var mı (grep: pdks|mesai|puantaj|devam|yoklama)? Rıza verme/geri alma regresyonu?
4. **Taslak koruması / form durumu**: `SettingsFormState` + `useUnsavedChangesGuard` + proje değişimi guard'ı; üç kartın birbirinin dirty durumunu ezmesi; kayıt sırasında sekme değişimi; başarısız kayıtta taslağın korunması.
5. **A2 kuralları**: sabit renk/hex/palet sınıfı, emoji, gradyan, kart-içinde-kart, `useToast`, `any`/`as any`, `!` non-null yok; token ve `statusTone` kullanımı. Erişilebilirlik: etiketler, `aria-*`, odak yönetimi, diyalog klavye/Esc, hata alanı bağlantısı; 390px'te taşma riski (uzun proje adı/gerekçe/tutanak: `break-words`, `min-w-0`, tablo/flex).
6. **Yetki/gezinme**: `capabilities.ts` — yeni `privacy` sekmesi yalnız super_admin + project_admin'e mi; üye `/settings?tab=privacy` açarsa AccessDenied mi; `SettingsSidebar` mobil select ve masaüstü bağlantı; eski sekme anahtarları kırılmadı mı.
7. **Asistan akışı**: `useMessageHandler.ts` `projectId`yi gerçekten gönderiyor mu (aktif proje yokken ne olur)? Eski-istemci hata mesajı ("sayfayı yenileyin") UI'da `source:"error"` için anlaşılır gösteriliyor mu? Sohbet geçmişinde "Personel N" etiketleri tutarlı mı?
8. **Testler**: yazılan testler gerçekten davranışı mı sınıyor yoksa yalnız SSR render mı; kritik boşluklar (ör. imha düğmesi etkinleşme koşulları) listele.

Kapıları KENDİN koş: `node_modules/.bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "settings|privacy|consent|pdks/chat|capabilities"` · `node_modules/.bin/eslint src/components/settings src/components/pdks src/components/employees/EmployeeConsentsCard.tsx src/lib` · `npx vitest run src`.

## Rapor
`.claude/orca-specs/reports/review-kvkk1-frontend.md`: en üstte tek cümle sonuç ("canlıya hazır: evet/hayır"). Sonra bulgular KRİTİK/YÜKSEK/ORTA/DÜŞÜK: dosya:satır · sorun · somut senaryo · önerilen düzeltme. Koordinatörün gerçek oturumda 1440+390'da bakması gereken akışları ayrı listele.
Doğrulayamadığını "doğrulanamadı" yaz; uydurma bulgu yazma. `worker_done` ≤10 satır.
