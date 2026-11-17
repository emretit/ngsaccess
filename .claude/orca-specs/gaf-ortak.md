## Ortak kurallar — Genel audit düzeltmeleri (ngsaccess: React+Vite web + Convex backend, TypeScript strict)

### Ortam
- Dizin: /Users/emreaydin/ngsaccess (main, ortak ağaç, worktree YOK). Aynı anda 4 worker daha BAŞKA dosyalarda çalışıyor. Çalışma ağacında "genel audit Dalga 1" düzeltmelerinin commit'lenmemiş değişiklikleri var (liste: `.claude/pathspec-genel-audit-w1.txt`; denetim raporu `docs/genel-audit-2026-11-03/DENETIM-DALGA1.md`). Ownership listende olmayan hiçbir değişikliğe DOKUNMA, geri alma, biçimlendirme; ownership listendeki dosyada Dalga 1 değişikliği varsa ÜSTÜNE kur.
- Önce `CLAUDE.md` ve `convex/_generated/ai/guidelines.md` oku.
- Bulguların tam metni (kanıt satırları, senaryo, öneri): `docs/genel-audit-2026-11-03/<rapor>.md`. Bağlayıcı kararlar ve yeniden sınıflama: `docs/genel-audit-2026-11-03/OZET.md`. Plan: `.claude/plan-genel-audit-fix.md`.
- Satır numaraları audit anındadır; kodu okuyup doğrula. Bulgu kodda artık yoksa ya da yanlışsa düzeltme yapma, raporda yaz.

### Yazma sınırı
- Yalnız "Ownership" listesindeki dosyalara + o dosyaların test dosyalarına yaz. Yeni test dosyası aynı klasörde açılabilir. Başka bir dosya gerekirse DUR ve preamble'daki `ask` komutuyla sor (koordinatör sahibine yönlendirir).
- `convex/schema.ts` ortak dosyadır: şema değişikliği gerekiyorsa önce `ask` ile sor. Yeni üst düzey `convex/*.ts` modülü açma (codegen gerekir); yardımcıları `convex/lib/` altına koy.

### YASAK (ihlal = görev başarısız)
- `git add`, `git commit`, `git stash`, `git checkout`, `git restore`, `git reset`, `git push`, `git switch`, `git worktree`. Yalnız okuma: `git log/show/diff/blame/status`.
- `npx convex dev|deploy|run|codegen|import|export`, Netlify, Supabase MCP, herhangi bir canlı DB okuma/yazma, tarayıcı, cihaz/köprü sunucusuna bağlanma, `npm install`.
- Commit ve yayını koordinatör Emre'nin onayıyla yapar.

### Kod kuralları
- TypeScript: `any` / `as any` yasak; bilinmeyen veri `unknown` + daraltma; `!` yerine erken return. Convex alanları camelCase, handler'lar şema alan adlarını olduğu gibi döner. `db.get` dizilerinde `filter((p): p is NonNullable<typeof p> => p !== null)`.
- Node modülü (crypto, gateway core vb.) içe aktaran convex dosyası `"use node"` ister; tsc/vitest bunu yakalamaz. Node-yalnız modülü yeni bir dosyaya içe aktarma.
- Index'siz `filter`, sınırsız `collect`, yeni poll/cron ekleme (kota yangını geçmişi var).
- Arayüz metni Türkçe ve sade, teknik terim yok; kullanıcıya görünen terim "cihaz"; zamanlar Türkiye saati (Europe/Istanbul).
- Mevcut testlerin BEKLENEN SAYILARINI toplu güncelleme. Bir beklenti değişmek zorundaysa tek tek gerekçesini raporda yaz; emin değilsen `ask`.

### Bağlayıcı ürün kararları
- Cihazdaki ngsplus dışı/yerel kişiler hiçbir otomatik akışla silinmez; ngsplus'ın yönettiği kişinin hedefli iptali (pasif, ayrılma, kural/üyelik kaldırma) beklenen davranıştır.
- 2FA yok; roller sabit 5 rol × 13 yetki (`convex/roles.ts`, `convex/lib/permissions.ts`); özel rol yok.
- Parmak izi/yüz okutmaları PDKS'ye girer. Vardiyası olmayan kişide PDKS yok. Hafta tatili vardiya planından gelir (K1: haftalık planda seçilmeyen gün her zaman hafta tatili).
- Denetim kaydında sır değeri yazılmaz; `passwordChanged: true` gibi işaret yazılır.

### Kapılar (hepsi yeşil olmadan worker_done YOK)
1. `node_modules/.bin/tsc --noEmit -p convex` ve `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` — senin dosyalarında 0 hata. Başka worker'ın yarım dosyasından gelen hata olursa düzeltme, raporda dosya:satır yaz.
2. `node_modules/.bin/eslint <değiştirdiğin dosyalar>` — error 0.
3. `node_modules/.bin/vitest run <ilgili test dosyaları>`. Her davranış değişikliği için test ekle (bulgunun senaryosu kırmızı→yeşil). Convex modülü değiştirdiysen `grep -rln "vi.mock(.*<modül adı>" src convex` ile o modülü mock'layan testleri bul ve onları da koş. Tam paketi koşma (koordinatör koşar).

### Bitiş
- worker_done: ≤10 satır — bulgu ID → ne değişti (dosya:satır), eklenen test, kapı sonuçları (ör. "vitest 3 dosya 42/42, tsc 0/0, eslint 0"), yapılamayan/ertelenen. `--files-modified` ile tam dosya listesi. worker_done'dan sonra hiçbir git komutu çalıştırma ve yeni iş başlatma.
