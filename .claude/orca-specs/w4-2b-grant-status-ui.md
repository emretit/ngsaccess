# W4.2b — Yetki durumu ekranı: ARAYÜZ (UYGULAMA)

## Ortak kurallar (bu repo; CLAUDE.md'yi okumadığın için buraya gömüldü)
- TypeScript strict; `any`/`as any`/`!` yok; Convex sonuçları `FunctionReturnType<typeof api.X.Y>` ile; form payload'ı `z.infer`.
- Türkçe metin; Europe/Istanbul saat gösterimi (repo'daki mevcut tarih biçimleyicilerini kullan); mevcut `src/components/ui/*` bileşenleri; 360 px'de taşma yok. Yeni bağımlılık YOK; testler mevcut SSR + saf fonksiyon desenleriyle (Testing Library yok).
- YASAK: commit, push, deploy, `npx convex *`, DB yazma, `convex/**` (salt-okuma; backend açığı bulursan `ask`), `mobile/**`, `bridge/**`, `package.json`/lock.

## Hedef (test edilebilir)
Erişim Kontrolü sayfasında üçüncü sekme **Yetki Durumu**: proje yöneticisi kişi×cihaz dağıtım durumunu sayaç çipleri + filtrelerle görür, Kişi ve Cihaz görünümü arasında geçer, seçilileri ya da hatalıları yeniden dağıtır. Ekran REAKTİF DEĞİL.

## Bağlam
- Backend bu worktree'de hazır (commit'siz W4.2a). API özeti `/tmp/w42a-api.md` — ÖNCE OKU. Modül `convex/accessGrantStatus.ts`.
- Tasarım (salt-okuma): `/Users/emreaydin/ngsaccess/.claude/designs/w4-template-claude.md` §5 madde 4 + §4 "Okuma maliyeti".
- Sayfa: `src/components/access-control/unified/UnifiedAccessControl.tsx` (W4.1'de `Kurallar · Zaman Şablonları` sekmeleri + `?tab=`), şablon sayfası örnek desen `src/components/access-control/unified/templates/*`, departman ağacı `components/DepartmentTree.tsx`, run bildirimi `SyncRuns.tsx`, yetki `useActiveProject().isAdmin`.

## Değişiklik
1. **Sekme:** `Kurallar · Zaman Şablonları · Yetki Durumu` (`?tab=status`). Yalnız `isAdmin` görür (project_user'a sekme gösterilmez).
2. **Veri yükleme:** `useConvex().query(...)` ile tek seferlik; "Yenile" butonu + "Son yenileme: HH:MM". Kullanıcının başlattığı yeniden dağıtım run'ı bitince (mevcut run izleme/`SyncRuns` sinyali) TEK otomatik yenileme. `useQuery` aboneliği bu ekranda YOK (run durumu izleme hariç, o zaten mevcut).
3. **Sayaç çipleri:** Tümü / Etkin / Bekliyor / Hata / Kaldırıldı / Bilinmiyor; `capped` ise "1000+". Çipe tıklama durum filtresi.
4. **Filtreler:** departman (DepartmentTree ya da mevcut seçici), cihaz, kural, şablon, durum, ad arama (300 ms debounce). Filtre değişince sayfa 1'den yeniden yükle.
5. **Kişi görünümü (varsayılan):** kolonlar Kişi · Departman · Cihaz · Kapı(lar) · Kural · Şablon · Durum (renkli rozet; Hata'da `lastError` ipucu; `stale` ise "Güncel değil" ek rozeti) · Son güncelleme. Sayfalama "Daha fazla yükle" (cursor). Mobilde kart düzeni.
6. **Cihaz görünümü:** cihaz başına sayaçlar (Etkin/Bekliyor/Hata); satır açılınca o cihazın kişileri (aynı sorgu `deviceId` filtresiyle).
7. **Kişi detayı:** kişi adına tıklayınca yan panel/dialog: `byEmployee` → cihaz satırları + "Bilinmiyor" (yetkili ama kayıt yok) + "Kaldırılacak" (kayıt var ama artık yetkisiz) + "Yetkisiz kapılar".
8. **Aksiyonlar (yalnız isAdmin):** satır seçimi (checkbox, en çok 100; aşarsa uyarı) → "Seçilileri yeniden dağıt"; "Hatalıları yeniden dağıt" (`onlyFailed`). Onay penceresi: "N kişi×cihaz için tek gönderim başlatılacak." Backend Türkçe hatasını göster; başarıda mevcut run bildirimi (`RuleSaveNotice`/`SyncRuns` deseni).
9. **Boş durum açıklaması:** "Bu özellik açılmadan önceki dağıtımlar 'Bilinmiyor' görünür; 'Tümünü yeniden dağıt' ile güncellenir." + Hik kapı bilgisinin kural kapsamından türetildiği notu.

## Testler (SSR + saf fonksiyon)
- Saf: sayaç → çip metni (1000+), filtre → sorgu argümanı eşlemesi, seçim sınırı (100), yeniden-dağıt onay metni, rozet/ipucu seçimi (stale, lastError).
- SSR: isAdmin=false'ta sekme yok/aksiyon yok; boş durum metni; Kişi görünümü kolon başlıkları; cihaz görünümü sayaçları.
- Reaktif olmadığını gösteren test: bileşen `useQuery(api.accessGrantStatus.*)` kullanmıyor (modül mock'u ya da saf yükleyici fonksiyonu üzerinden).
- Mevcut testlerin tamamı yeşil.

## Ownership (yalnız bunlara yaz)
`src/components/access-control/unified/**` (yeni alt klasör `status/` serbest) · `src/types/access-control.ts` (gerekirse). Başka dosya gerekiyorsa önce `ask`.

## Kapsam dışı
Backend değişikliği · backfill · cihazdan geri okuma · tatil · mobil.

## Kapılar
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0 · `node_modules/.bin/eslint src convex` → 0 error · `node_modules/.bin/vitest run` → tamamı yeşil (sayı) · `node_modules/.bin/vite build` → OK.

## Rapor
`/tmp/w42b-report.md` + `worker_done`'da ≤10 satır (file:line): yeni/değişen dosyalar · giriş noktaları · reaktif-olmama kanıtı · backend'de gördüğün açık (varsa) · kapı sayıları.
