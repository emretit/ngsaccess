# Görev: Oturumsuz sayfalar P4 — kod denetimi (SALT-OKUR; kodu Codex yazdı, denetçi Claude)

## Hedef (test edilebilir)
`/tmp/pub-p4/REVIEW.md` üretilmiş olsun: commit kapsamındaki diff (HEAD ↔ çalışma kopyası) satır satır okunmuş; her sorun `R-xx` satırı
(önem · file:line · ne bozuluyor · somut senaryo · önerilen düzeltme) olarak listelenmiş; kendi koştuğun tam kapı sonuçları yazılmış.
Bu worker KOD DÜZELTMEZ.

## Bağlam
Repo `/Users/emreaydin/ngsaccess` — React 19 + Vite + Tailwind 4 + shadcn/ui; backend Convex (`convex/**` bu işte değişmedi).
Public sayfalar (landing, giriş/kayıt, 6 durum ekranı) V2 tasarımına geçirildi; amaç YALNIZ görünüm. Akış davranışı DEĞİŞMEMELİYDİ.
Kurallar: `CLAUDE.md` (any/`as any` yasak, `!` yerine optional chaining, Convex sonucu `any[]`'a açılmaz) · `docs/ui-scan/public/DESIGN_PUBLIC.md`
§Erişilebilirlik ve hareket + §Akış kuralları (davranış sözleşmesi burada) · A2 yasakları (HEX/`bg-white`, gradyan, `dark:` varyantı public'te yok).

## Denetlenecek diff (YALNIZ bunlar — çalışma ağacında başka oturumların ilgisiz değişiklikleri var, onları denetleme)
`index.html` · `src/App.tsx` · `src/components/Layout.tsx` · `src/hooks/{useDarkMode,usePageTitle}.ts` · `src/index.css` · `src/components/public/**` ·
`src/components/landing/**` (silinenler dahil) · silinen `src/components/demo/**` + `src/pages/DemoRequest.tsx` · `src/components/ui/logo.tsx` ·
`src/pages/{LandingPage,Login,Login.test,Register,VerifyEmail,UserSetup,AdminSetup,EmployeeSetup,CheckIn,NotFound}.tsx`.
Eski hali: `git show HEAD:<yol>`. Yeni dosyalar (`git status` `??`) tamamen okunur.

## Odak (öncelik sırası)
1. **Davranış korunumu** — her sayfada HEAD ↔ yeni: çağrılan her `useQuery`/`useMutation`/`useAction`/`useAuth` fonksiyonu ve argümanı, `navigate`
   hedefleri, query param okuma, koşul dalları, loading/disabled durumları, hata mesajı eşlemesi aynı mı? Özellikle:
   Login (60 sn cooldown, `verificationEmail`, `?confirmEmail=true`, `emailNotConfirmed`, yeniden doğrulama isteği, giriş sonrası yönlendirme) ·
   Register (alanlar, zod şeması, başarı yönlendirmesi) · VerifyEmail (token yok/geçersiz/başarı, yeniden gönderme) · UserSetup (davet token,
   e-posta readonly, `existingAccount` modu, şifre kuralları) · AdminSetup (`runSetup`, zaten kurulu, existing modu, kurulum kodu) ·
   EmployeeSetup (token dalları) · CheckIn (başarı yalnız backend success sonrası, `locationRecorded`, ağ belirsizliğinde tekrar-gönder yok, İstanbul saati).
   Kaybolan/eklenen her dal = bulgu (eklenen dal DESIGN_PUBLIC §Akış kurallarında varsa bulgu değil, not).
2. **Tema** — `useDarkMode` artık yalnız `Layout` içinde ve unmount'ta `.dark`'ı kaldırıyor. Kontrol et: uygulama içi koyu tema hâlâ çalışıyor mu;
   `src/components/settings/sections/GeneralSettings.tsx:24-25` canlı önizleme toggle'ı, `src/components/settings/sections/hooks/useDarkMode.ts` (ikinci kopya),
   `src/components/pdks/chat/useExportUtils.ts:24-38` ile çakışma; `Layout` dışındaki authed sayfa var mı (`src/App.tsx` rotaları); logout → public geçişinde
   koyu tema sızıyor mu; sayfa yenilemede açık→koyu flaş (önceden de var mıydı?).
3. **Erişilebilirlik sözleşmesi** (DESIGN_PUBLIC §Erişilebilirlik): tek h1, skip-link → `#main`, form hatası `aria-describedby`, ilk geçersiz alana odak,
   genel hata `role=alert`, autocomplete değerleri, şifre göster/gizle `aria-pressed`.
4. **Kod kuralları** — `any`, `as` ile tip zorlaması, `!`, `filter(Boolean)` tip kaybı, HEX/`bg-white`/`bg-black`, `dark:` (public dosyalarda),
   kullanılmayan export/dosya (`grep -rn` ile doğrula), `public.css`'te kullanılmayan seçici.
5. **Güvenlik** — token/e-posta URL'de taşınmıyor (`/demo-request` yönlendirmesi dahil), `dangerouslySetInnerHTML` yok, `target=_blank` → `rel="noopener noreferrer"`,
   `index.html`'de üçüncü taraf betik yok.
6. **Testler** — `src/pages/Login.test.tsx`, `src/components/public/*.test.tsx`, `src/components/landing/marketingFacts.test.ts`: gerçekten davranışı mı ölçüyor;
   eksik kritik test listesi (ör. CheckIn belirsiz sonuç, UserSetup existing modu).

## Kapılar (KENDİN koş; sonuçları rapora yaz)
1. `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → hata sayısı.
2. `node_modules/.bin/eslint src convex` → `no-explicit-any` sayısı + diğer error'lar (public dışı dosyalardakileri ayrı say, bulgu yapma).
3. `node_modules/.bin/vitest run` (tümü) → geçen/kalan; kalanların public işle ilgisi var mı.
4. `node_modules/.bin/vite build` → OK/hata.

## Ownership
YALNIZ `/tmp/pub-p4/REVIEW.md` (+ `/tmp/pub-p4/review-*` yardımcı dosyalar). Repo'ya yazma.

## YASAK
Kod düzeltme · commit/push/deploy · `npx convex …` · canlı DB/Convex/Supabase okuma-yazma · arka planda açık sunucu.

## Rapor
`worker_done` ≤10 satır: önem bazında bulgu sayısı, en kritik 3 bulgu file:line, 4 kapı sonucu, `reportPath=/tmp/pub-p4/REVIEW.md`.
REVIEW.md formatı: `R-xx | 🔴/🟠/🟡/⚪ | file:line | sorun | senaryo | düzeltme` tablosu + "Kontrol edildi, sorun yok" listesi (hangi dalı doğruladın).
