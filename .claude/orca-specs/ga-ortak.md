## Ortak kurallar — Genel audit 2026-11-03 (ngsaccess: React+Vite web + Convex backend, TypeScript strict)

Bu bir SALT-OKUMA audit görevidir. Kod DEĞİŞTİRME, düzeltme YAPMA. Tek çıktın aşağıda "Rapor dosyası" olarak verilen markdown dosyasıdır.

### Çalışma ortamı
- Dizin: /Users/emreaydin/ngsaccess (main, ortak ağaç, worktree YOK). Aynı anda 7 worker daha başka modülleri inceliyor; her biri yalnız kendi rapor dosyasına yazıyor.
- Çalışma ağacında başka oturumun commit'lenmemiş değişiklikleri var (özellikle `convex/lib/pdks*`, `convex/lib/shift*`, `convex/shiftPlans.ts`, `src/components/pdks/settings/*` — "hafta tatili vardiyadan" işi). Bunlara DOKUNMA. Kodu çalışma ağacındaki haliyle incele; bir bulgu commit'lenmemiş değişiklikten geliyorsa satırına "(commit'siz)" yaz (`git diff --stat` ile bak).
- Önce `CLAUDE.md` ve `convex/_generated/ai/guidelines.md` oku (Convex kuralları).

### YASAK (ihlal = görev başarısız)
- Rapor dosyası DIŞINDA hiçbir dosyaya yazma/silme. Yeni test, fixture, script dosyası da yok.
- `git add`, `git commit`, `git stash`, `git checkout`, `git restore`, `git reset`, `git push`, `git switch`, `git worktree` — hiçbiri. Yalnız okuma: `git log`, `git show`, `git diff`, `git blame`.
- `npx convex dev|deploy|run|codegen|import|export`, Netlify, Supabase MCP, herhangi bir MCP yazma aracı, canlı DB okuma/yazma, tarayıcı, Hik-Connect portalı, `npm install`.
- Tüm test paketini koşma (`vitest run` çıplak, `npm test`). İzinli: şüpheyi doğrulamak için tek seferde en fazla 3 dosya `node_modules/.bin/vitest run <dosya...>`.

### Bağlayıcı ürün kararları (bunları bulgu olarak yazma)
- 2FA yapılmayacak (Emre 2026-10-26).
- Parmak izi/yüz okutmaları PDKS'ye girer (biyometrik yasağı kaldırıldı 2026-10-26).
- Cihazdaki kişiler asla otomatik silinmez (2026-10-28); toplu temizlik yok.
- Vardiyası (tarihli ataması) olmayan kişide PDKS yok, yalnız geçiş kaydı.
- Hafta tatili vardiyadan gelir; "Çalışma günleri" ayarı kalkıyor (commit'siz iş).
- Roller sabit: 5 rol × 13 yetki, proje bazlı (`convex/roles.ts`). Özel rol tasarımı yok.
- Hik-Connect'te olup gereksiz sayılanlar: harita, captive portal, video kayıt şablonu, konut yönetimi, AD eşitleme, lisans/servis pazarı. Bunları "eksik" yazma.
- Kullanıcıya görünen terim "cihaz"; zamanlar Türkiye saati (UTC+3).

### Ne ararsın (önem sırasıyla)
1. **Güvenlik / yetki:** proje izolasyonu (başka projenin verisi okunur/yazılır mı), rol kontrolü eksik mutation/query, `internal` olması gereken public fonksiyon, sır (şifre/token) sızıntısı, okuma-gate ile yazma-gate uyumsuzluğu.
2. **Veri doğruluğu:** yanlış hesap (puantaj, fazla mesai, SGK, saat dilimi), yarış durumu, yarım kalan çok adımlı işlem, silinen kaydın yetim bıraktığı veri, cihaz ↔ veritabanı tutarsızlığı.
3. **Convex verimliliği / kota:** index'siz `filter`, sınırsız `collect`, sık poll/cron, gereksiz action→mutation zinciri, büyük döküman okuma (kota yangını geçmişi var: IDE poll, Hik köprü poll).
4. **Kullanıcı akışı:** kırık/eksik akış, hata mesajı yok, boş/yükleme durumu yanlış, yetkisiz kullanıcıya görünen ama çalışmayan buton.
5. Ölü kod ve tekrar yalnız gerçek risk taşıyorsa (stil/isimlendirme notu YAZMA).

Her bulguyu kodu okuyarak doğrula: somut `dosya:satır`, somut senaryo ("X rolündeki kullanıcı Y çağırırsa Z olur"). Emin değilsen "[olası]" etiketi koy, eminsen "[kesin]". En fazla 25 bulgu; zayıf olanı ele.

### Hik-Connect kıyası (her modülde zorunlu)
Kaynaklar (yalnız belgeler; portala gitme):
- `docs/hikconnect-audit/HIKCONNECT_SAYFALAR.md` — canlı Hik-Connect Team portalı sayfa sayfa (2026-10-19)
- `docs/hikconnect-audit/KIYAS.md` — Hik ↔ ngsaccess kıyası (2026-10-19, güncelleme 2026-10-25/26)
- `docs/hikconnect-audit/PDKS_KIYAS.md`, `docs/hikconnect-reports/README.md` (+ `report-definitions.json`) — REA ile çıkarılan rapor kataloğu
- `docs/hikconnect-audit/NGSACCESS_ENVANTER.md`, `UYGULAMA_PLANI.md`, `WEB_PLAN.md`
Yapacağın: modülüne ait her Hik satırını bugünkü koda karşı YENİDEN doğrula. Belgedeki durum (✅/🟡/❌/➕) hâlâ doğru mu, `[teyit]` işaretli satırlar ne çıktı, belgede olmayan yeni Hik farkı var mı. Kanıt `dosya:satır` olsun.

### Önceki audit açıkları
Modülüne ait maddeleri bul ve durumunu yaz (kapandı / açık / kısmi + kanıt): `docs/genel-akis-audit/OZET.md` (+ A/B/C dosyaları), `.claude/handoff-sistem-audit-kalan.md`, modül spec'inde ayrıca verilenler.

### Rapor dosyası biçimi (Türkçe, sade dil, jargonu parantez içinde açıkla)
```
# <Modül adı> — Genel audit 2026-11-03

## Özet
<1-3 cümle: en önemli sonuç + P0/P1/P2 sayıları>

## Bulgular (en ciddi önce)
| ID | Önem | Kesinlik | Başlık | Kanıt (dosya:satır) | Ne olur (senaryo) | Öneri | Efor |
Önem: P0 = güvenlik açığı / veri kaybı / yanlış puantaj-maaş / yetkisiz erişim · P1 = yanlış davranış, kullanıcıyı etkiler · P2 = UX, tutarlılık, kota/verimlilik riski
Efor: S (<1 saat) · M (yarım gün) · L (1+ gün)

## Hik-Connect kıyası
| Hik özelliği | Hik sayfası | ngsaccess (dosya:satır) | Durum | Belgeye göre değişim | Not |

## Hik'te olup bizde eksik — öneri sırası (en fazla 5, değer/efor gerekçesiyle)

## Bizde olup Hik'te olmayan (kısa liste)

## Önceki audit açıkları
| Kaynak madde | Durum | Kanıt |

## Kapsam ve yöntem
<okunan ana dosyalar, koşulan komutlar ve sonuçları, doğrulanamayanlar>
```

### Bitiş
- Rapor dosyasını yazdıktan sonra `git status --short` çıktısında senin eklediğin TEK satır rapor dosyası olmalı (başka değişiklik görürsen o başka oturumundur, dokunma).
- worker_done: ≤10 satır — P0/P1/P2 sayıları, en kritik 3 bulgu ID + tek cümle, Hik kıyasında belgeye göre değişen satır sayısı. `--report-path <rapor dosyası>` ver. `--files-modified` olarak yalnız rapor dosyası. worker_done'dan sonra hiçbir komut çalıştırma.
