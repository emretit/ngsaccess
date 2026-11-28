# Self-host kararı: bağımsız değerlendirme (Claude), 28 Kasım 2026

**Sonuç (5 satır)**
1. **8-10 Aralık açılışı için güvenli yol: Convex Cloud'da kal, Free'den ücretli plana geç (C ya da D).** Bu yalnız bir fatura değişikliği. URL, mobil sürüm, veri taşıma ve yeniden giriş gerekmez.
2. **Bugün self-host (A/B) yanlış zamanlama.** Taşıma 6-10 günlük iş istiyor (mobil sürüm dahil). Bilinen SQLite bellek hatalarının düzeltmesi main'e **3 gün önce** (25 Kasım) girdi ve henüz sahada denenmedi. Destek de yalnız Discord'dan.
3. **Aynı Hetzner'e kurmak (A) en riskli seçenek.** Convex'in disk ya da bellek sorunu, kart olaylarını alan gateway'i ve Pafta'yı da durdurabilir. Bir servisin ele geçirilmesi üç ürünün verisini birden açar.
4. **Para farkı küçük, zaman farkı büyük.** Cloud ayda $5-31 tutuyor, self-host €8-19. Buna karşılık self-host Emre'den ayda kabaca **5-11 saat** (ilk 3 ay 10-20 saat) ve bir kerelik **50-80 saat** alıyor. 20 müşteride Pro, Starter'dan ucuza geliyor.
5. **Self-host'a ancak şu koşullarda yeniden bakılmalı:** Cloud faturası düzenli olarak ayda ~$150-300'ü aşarsa, bir müşteri sözleşmeyle "kendi sunucunuz" şartı koyarsa ya da Convex fiyat politikası bozulursa. Önce ayrı bir VM'de, Postgres'le ve 2-4 hafta paralel prova yapılmalı.

Yöntem: yalnız okuma yaptım. Repo raporlarını, resmî Convex sayfalarını, GitHub repo, issue ve commit'lerini, bağımsız bir üretim blogunu ve durum sayfası kayıtlarını okudum (erişim tarihi hepsi için 2026-11-28). SSH, `npx convex`, deploy ya da kod değişikliği yapmadım.

---

## 1. Self-hosted Convex üretim olgunluğu

### Resmî tutum
- **"Self hosting is not for everyone. If you're looking for a more hands-off solution, we recommend using the Convex-hosted product."** Resmî self-hosting sayfasında "production" kelimesi geçmiyor. Kaynak: [docs.convex.dev/self-hosting](https://docs.convex.dev/self-hosting)
- **Destek yalnız topluluktan:** "Support is available on the Convex Discord in the `#self-hosted` channel." Self-host'un ücretli destek planı ya da SLA'sı (hizmet seviyesi taahhüdü) yok. Cloud'da da SLA yalnız Business/Enterprise planında var; Pro'da yok. Kaynaklar: [self-hosted/README.md](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md), [convex.dev/pricing](https://www.convex.dev/pricing)
- **Kapsam:** "Self-hosted Convex supports all the free-tier features of the cloud-hosted product. The cloud-hosted product is optimized for scale." Kaynak: README.
- **Duyuru (13 Şubat 2025):** Cloud "still the recommended configuration for most users"; self-host "usable for real applications" deniyor. Kaynak: [news.convex.dev/self-hosting](https://news.convex.dev/self-hosting/)

### Sürüm sıklığı ve kırıcı değişiklikler
- GitHub'da neredeyse her gün "precompiled" sürüm çıkıyor: 9-27 Kasım arasında yaklaşık 40 sürüm. Son 200 sürümün yalnız 14'ü "pre-release" etiketli değil; son "Latest" 21 Kasım 2026. Kaynak: [github.com/get-convex/convex-backend/releases](https://github.com/get-convex/convex-backend/releases)
- **Değişiklik günlüğü 17 Eylül 2025'ten beri tutulmuyor:** "we're not going to update this changelog as frequently. Check `git log`". Yani kırıcı değişiklikleri derleyen bir not yok, commit geçmişini kendin okuman gerekiyor. Ayrıca backend ve dashboard aynı sürümde olmalı: "Different versions are not guaranteed to be compatible". Kaynak: [self-hosted/CHANGELOG.md](https://github.com/get-convex/convex-backend/blob/main/self-hosted/CHANGELOG.md)
- **Yükseltme yöntemi:** Yerinde DB migration yapılıyor; resmî doküman "rare cases in which this does not work smoothly" diyor. Bu durumda export → yeni imaj → `import --replace-all` yapılır ve bu kesinti demektir. Her yükseltmeden önce export öneriliyor. Kaynak: [self-hosted/advanced/upgrading.md](https://github.com/get-convex/convex-backend/blob/main/self-hosted/advanced/upgrading.md)
- İlk self-host sürümü (Şubat 2025) diski dolduran bir hatayla çıkmıştı: "DO NOT use this version in production!" (CHANGELOG).

### GitHub issue'ları (2025-2026, açık olanlar; NGS Access ile ilgisine göre)

| Issue | Ne oluyor | NGS Access'e etkisi |
|---|---|---|
| [#495](https://github.com/get-convex/convex-backend/issues/495) (25 Haziran 2026) | SQLite'ta indeks sorgusu `LIMIT`'i yok sayıyor ve aralığın tamamını belleğe alıyor. Sonuç OOM (bellek tükenmesi) ve "too many system operations" hatası. 100-200 bin kayıtta 30 GB RAM'e çıktığı raporlanmış. | Kodda 596 `.take()/.first()` çağrısı var. `cardReadings` tablosu müşteri başına ayda ~44 bin kayıt büyüyor. **Düzeltme main'e 25 Kasım 2026'da girdi** ("Paginate SQLite index_scan"). |
| [#593](https://github.com/get-convex/convex-backend/issues/593) (9 Ekim 2026) | SQLite her açılışta belge geçmişinin tamamını belleğe yüklüyor. 3,4 M satırda 17-22 GB heap ve 7 dakikalık açılış. 11 GB DB'de 48 GiB sınırda OOM raporu var. | Planlanan 5 GB Docker sınırıyla, birkaç milyon sürüme ulaşınca **açılamayan backend** riski doğar. Düzeltme 25 Kasım 2026'da main'e girdi ("Page SQLite document history reads"). |
| [#563](https://github.com/get-convex/convex-backend/issues/563) | Deploy ve eşzamanlı sorgulardan sonra bellek geri verilmiyor (glibc). Geçici çözüm `MALLOC_ARENA_MAX=2`. | Her deploy'da RSS (kullanılan fiziksel bellek) birikiyor; 5 GB sınırını zorlar. |
| [#565](https://github.com/get-convex/convex-backend/issues/565) | Node executor takılıyor ve container yeniden başlatılana kadar **tüm Node action'lar** duruyor. Raporda 32 dakikada 209 zamanlanmış iş başarısız olmuş. | Projede 41 `"use node"` dosyası var (gateway komutları, mail). Gece kapı/cihaz komutları durabilir. |
| [#519](https://github.com/get-convex/convex-backend/issues/519), [#492](https://github.com/get-convex/convex-backend/issues/492), [#639](https://github.com/get-convex/convex-backend/issues/639) | Node action modülü boş önbelleğe alınıyor (restart'a kadar bozuk kalıyor). Eşzamanlı çalışmada env değişkenleri `undefined` geliyor. `env set` sonrası eski değer kalıyor. | `HIK_GATEWAY_*` ve mail env'leri ara sıra boş gelebilir. |
| [#612](https://github.com/get-convex/convex-backend/issues/612), [#622](https://github.com/get-convex/convex-backend/issues/622), [#648](https://github.com/get-convex/convex-backend/issues/648) | Scheduler bazen 5 saniye uyuyor ve `runAfter(0)` işleri gecikiyor. | Kodda 131 `runAfter(0)` var (`doors.ts` dahil). Kapı açma 5 saniyeye kadar gecikebilir. |
| [#608](https://github.com/get-convex/convex-backend/issues/608), [#93](https://github.com/get-convex/convex-backend/issues/93) | Her restart veri diskinde geçici klasör bırakıyor (raporda 13,8 GB). Log ve dosyalar silinmiyor. | **Ortak sunucuda disk dolarsa gateway ve Pafta da durur.** |
| [#358](https://github.com/get-convex/convex-backend/issues/358), [#101](https://github.com/get-convex/convex-backend/issues/101), [#628](https://github.com/get-convex/convex-backend/issues/628), [#588](https://github.com/get-convex/convex-backend/issues/588) | Retention döngüsü yüzünden OOM, rastgele ve kurtarılamayan OOM (2025), 4 vCPU/8 GB'de aralıklı 1 sn zaman aşımı, self-host'ta indeks önbelleğinin kullanılmaması. | Genel kararlılık ve performans riski. |
| [#271](https://github.com/get-convex/convex-backend/issues/271), [#395](https://github.com/get-convex/convex-backend/issues/395) | Prod yedeğini yerel deployment'a geri yükleyememe, R2'ye export hatası. | Geri yükleme provası şart. |

- Örneklediğim issue'larda (#495, #593) yorumların hepsi topluluktan; Convex ekibinden yanıt görmedim. Düzeltmeler ise iç repodan senkronla geliyor (sqlite commit'leri, 25 Kasım 2026). Kaynak: [commits?path=crates/sqlite](https://github.com/get-convex/convex-backend/commits/main/crates/sqlite)
- Repo: 12,8 bin yıldız, 284 açık issue, son push 28 Kasım 2026. Bakım aktif.

### SQLite mi Postgres mi?
- README: "We recommend starting with this basic configuration [SQLite] … pointing the backend to a separate SQL database for a production-ready configuration as needed."
- Postgres/MySQL dokümanı: "**If you're running a production workload that requires guaranteed uptime it's likely you want to use a managed Postgres or MySQL service.**" Postgres v17 test edilmiş. DB, backend ile aynı bölgede olmalı. Kaynak: [postgres_or_mysql.md](https://github.com/get-convex/convex-backend/blob/main/self-hosted/advanced/postgres_or_mysql.md)
- Yukarıdaki en ağır bellek hataları (#495, #593) **SQLite'a özgü**. #593'te "Postgres persistence does not have this problem" yazıyor. Resmî metne ve issue'lara göre tek sunucuda SQLite "başlangıç" ayarı; uzun ömürlü üretim için Postgres yönü işaret ediliyor.

### Gerçek üretim örnekleri
- **Convex in Prod (1 Eylül 2026), bağımsız blog:** 32 vCPU / 64 GB sunucu ve MySQL kullanıyorlar; dakikada ~7 bin çalıştırma. Önemli cümleler:
  - "you shouldn't think of convex-backend as a system with 'first-class' self-hosted support"
  - "more of a proof-of-concept option than a production-ready feature"
  - ilk ayda "lower application availability"
  - "<8 vCPU" ile "non-negligible production load" önerilmiyor.
  - Onlarca ayar (knob) ve yamalı bir fork gerekmiş. Başa baş noktası Cloud'da ayda ~$1.000 fatura.

  Kaynak: [convex-in-prod.dev/posts/self-hosted-roi-lessons-configuration](https://convex-in-prod.dev/posts/self-hosted-roi-lessons-configuration/)
  - Not: bizim yükümüz çok küçük. 500 kişide günde ~2.000 okuma, yani ortalama dakikada ~1-2 olay. Bu yüzden donanım uyarısı bize tam uymuyor. Ama işletme dersleri (ayarlar, bellek, ilk ay kararsızlığı) uyuyor.
- Daha küçük kurulum anlatıları da var: [bitdoze 2026 rehberi](https://www.bitdoze.com/convex-self-host/), [dev.to bare-metal](https://dev.to/fredysandoval/bare-metal-convex-develop-and-deploy-with-the-minimum-stack-possible-30co), [dev.to kişisel API](https://dev.to/ryancwynar/why-i-self-host-convex-as-my-personal-api-layer-41h5). Bunlar kurulum anlatısı; uzun süreli üretim verisi içermiyor.

**1. bölümün özeti:** Self-host çalışıyor ve aktif geliştiriliyor. Ama resmî olarak "önerilen" yol değil; SLA'sı ve ücretli desteği yok. SQLite ve Node executor tarafında 2026'da açılmış ciddi hatalar var, ilk düzeltmeler de 3 günlük. Tek kişilik ekip için "kur ve unut" bir sistem değil.

---

## 2. Tek kişilik işletme yükü (Emre için tahmin)

| İş | Self-host (A/B), ayda | Cloud Starter (C), ayda | Cloud Pro (D), ayda |
|---|---|---|---|
| Sürüm güncellemesi: kopyada export → yeni imaj → smoke test → canlı | 2-3 sa | 0 | 0 |
| Yedek denetimi + aylık geri yükleme provası | 1-2 sa | 0,5-1 sa (otomatik yedek yok, gece `convex export` script'i kendi işin) | 0-0,5 sa (günlük yedek dahil) |
| İzleme ve alarm bakımı (disk, RAM, spool, TLS) | ~1 sa | ~0,25 sa (kullanım/fatura) | ~0,25 sa |
| İşletim sistemi/Docker yaması + yeniden başlatma | 0,5-1 sa | 0 | 0 |
| Olay müdahalesi (beklenen ortalama) | 1-4 sa (ilk 3 ay 4-10 sa) | ~0-0,5 sa (Convex'in kendi kesintisi, beklemek dışında iş yok) | aynı + e-posta desteği |
| **Toplam** | **5-11 sa** (ilk 3 ay **10-20 sa**) | **~1-2 sa** | **~0,5-1 sa** |
| Bir kerelik kurulum | **50-80 sa**: plan 3-5 gün + mobil upload host düzeltmesi + zamanlanmış iş uzlaştırma + photoUrl eşleme + 10 cihaza httpHosts yazma + mobil yayın ([self-host-review](../../.claude/orca-specs/self-host-review.md) D1-D8) | 3-4 sa (gece export script'i + dış depo) | ~0 |

Varsayım: alarmlar Emre'yi gece uyandırıyor ve ikinci bir nöbetçi yok. Self-host'ta Convex düştüğünde müdahale eden tek kişi Emre. Cloud'da altyapı arızası Convex'in sorunu; Emre'nin işi uygulama hatalarıyla sınırlı.

---

## 3. Aynı sunucuyu Pafta ve Hik gateway'le paylaşmanın riski (A)

1. **Tek hata noktası büyüyor.** Çekirdek yaması, Docker güncellemesi ya da donanım arızası tek reboot'ta kart olaylarını (gateway), backend'i ve Pafta'yı birlikte düşürür. Bakım penceresini üç ürün için aynı anda bulmak gerekir.
2. **Disk ortak ve sınırsız.** Docker'daki 5 GB sınır yalnız RAM'i kapsar. #608 (her restart'ta GB'larca tmp), #93 (silinmeyen dosya ve loglar) ve export dosyaları 96 GB boş diski doldurabilir. Disk dolunca gateway spool'u yazamaz ve **olay kaybı** başlar (spool `MAX_QUEUE` 1000'de olayları düşürüyor, `bridge.mjs:217`).
3. **RAM ve CPU çekişmesi.** Bugün 9,2 GB boş; Convex'e 5 GB verilirse 4,2 GB kalıyor. Eski gateway dokümanı tek başına 4 GB minimum, 8 GB öneri yazıyor. #563 ve #593 bellek büyümesinde 5 GB sınırı **Convex'in OOM ile ölmesine** yol açar. Bu sunucuyu korur ama backend'i düşürür. Sınır konmazsa sunucunun tamamı etkilenir. CPU tarafı bugün rahat (load 0,3); vardiya başı pikleri ve rapor ya da backfill aynı anda gelince ölçülmeli.
4. **Güvenlik izolasyonu zayıf.** Gateway internetten ISUP (cihazların sunucuya bağlandığı Hik protokolü) kabul ediyor, yani saldırı yüzeyi geniş. Aynı root ve Docker ortamındaki SQLite dosyası tüm kişisel veriyi, biyometrik şablonları ve şifreleme anahtarlarını (env) içerecek. Bir servisin ele geçirilmesi NGS Access + Pafta verisinin birlikte sızması demek.
5. **Ayrı VM (B)** 2., 3. ve 4. maddeyi çözer ama 1. maddeyi yalnız kısmen çözer: Convex yine tek sunucu ve tek kişi. Yüksek erişilebilirlik (HA) sağlamaz.

---

## 4. Toplam sahip olma maliyeti (kaba)

Varsayımlar:
- $≈€ kabul edildi.
- Emre'nin saati **€30** varsayıldı; ayrıca saat olarak da verildi.
- Cloud kullanımı [FREE_PLAN](FREE_PLAN_2026-11-28.md) ölçümüne dayanıyor: müşteri başına bugünkü kodla 80 GB I/O, 1,28 M çağrı, 0,74 GB DB. "Düzeltmeli" senaryo: ana sayfa yenileme düzeltmesiyle müşteri başına ~3-5 GB I/O.
- 20 müşteri doğrusal büyüme varsayıldı.
- Fiyatlar [convex.dev/pricing](https://www.convex.dev/pricing) sayfasından:

| | Starter (ek kullanım) | Pro ($25/ay, dahil olanların üstü) |
|---|---|---|
| Çağrı | $2,20 / 1 M | $2 / 1 M (25 M dahil) |
| DB I/O | $0,22 / GB | $0,20 / GB (50 GB dahil) |
| DB depolama | $0,22 / GB | $0,20 / GB (50 GB dahil) |

**1 müşteri (aylık)**

| Seçenek | Altyapı / fatura | Emre zamanı | Bir kerelik | Risk |
|---|---|---|---|---|
| A self-host, aynı Hetzner | €7-10 (dış yedek) | 5-11 sa ≈ €150-330 | 50-80 sa ≈ €1,5-2,4 bin | **Yüksek**: paylaşılan disk/RAM, üç ürün tek hata noktası, taze SQLite düzeltmeleri |
| B self-host, ayrı VM | €17-19 | 5-11 sa ≈ €150-330 | 50-80 sa | **Orta-yüksek**: izole ama tek kişi, SLA yok |
| C Cloud Starter | Bugünkü kodla ~$18; düzeltmeyle ~$1-5. + gece export'u ~$3-7 I/O | ~1-2 sa ≈ €30-60 | 3-4 sa | **Düşük-orta**: otomatik yedek yok, e-posta desteği yok, SLA yok |
| D Cloud Pro | ~$25-31 (50 GB I/O dahil) | ~0,5-1 sa ≈ €15-30 | ~0 | **Düşük**: günlük yedek + e-posta desteği (SLA yine yok) |
| E: önce C/D, sonra karar | C ya da D gibi | C ya da D gibi | self-host ertelenir | Düşük; self-host provası acelesiz |

**20 müşteri (aylık, kaba)**

| Seçenek | Düzeltmeli kullanım (~60-100 GB I/O, ~25 M çağrı, ~15 GB DB ve büyüyor) | Düzeltmesiz (~1,6 TB I/O) | Not |
|---|---|---|---|
| A | €10-20 + 8-15 sa | aynı | SQLite'ta milyonlarca sürüme 1-2 yılda ulaşılır; bu bilinen hata bölgesi. Postgres'e geçiş ek iş. |
| B | CX43 €26-28 (+ yönetilen Postgres ise ek) + 8-15 sa ≈ €270-480 | aynı | Self-host'un parasal üstünlüğü yalnız düzeltmesiz senaryoda belirgin. |
| C Starter | ~$80-100 (çağrı ~$54 + I/O ~$22 + depolama) | ~$350+ | S16 sınıfı: 16 eşzamanlı query/mutation, 1.000 oturum sınırı. |
| D Pro | **~$35-60** | ~$310+ | 20 müşteride **Pro, Starter'dan ucuz**; S256 sınıfı. |

**4. bölümün özeti:** Self-host'un para avantajı, Emre'nin saatini hesaba kattığında 1 müşteride de 20 müşteride de yok. Faturayı plan seçiminden çok **I/O düzeltmesi** belirliyor: aynı kod self-host'ta da CPU ve disk yakıyor.

---

## 5. KVKK ve veri yeri

- Bugünkü deployment büyük olasılıkla **ABD (us-east-1)** bölgesinde. Bu bir çıkarım: URL'de bölge eki yok. AB deployment'larının adresinde `eu-west-1` ekli. Hetzner sunucusu (157.90.x) Almanya'da; bu da çıkarım.
- **İki seçenek de KVKK m.9 kapsamında yurt dışı aktarım.** Veri TR'de değil. 2024 değişikliğinden sonra yeterlilik kararı yoksa **standart sözleşme imzalanır ve 5 iş günü içinde Kurul'a bildirilir**. Kaynaklar: [KVKK Yurt Dışına Aktarım](https://www.kvkk.gov.tr/Icerik/2053/Yurtdisina-Aktarim), [Standart Sözleşme Bildirim Modülü duyurusu (25 Ekim 2024)](https://www.kvkk.gov.tr/Icerik/8043/Standart-Sozlesme-Bildirim-Modulu-Hakkinda-Kamuoyu-Duyurusu). Self-host bu yükümlülüğü kaldırmıyor, yalnız karşı tarafı değiştiriyor: Hetzner (DE) mi, Convex (+AWS, ABD) mi.
- Gerçek farklar:
  - Self-host'ta alt işleyen sayısı az (yalnız Hetzner) ve şifreleme anahtarlarıyla veri senin kontrolünde.
  - Cloud'da ABD şirketi ve ABD bölgesi var.
  - Biyometrik şablonlar özel nitelikli veri. Uygulamada `FINGERPRINT_TEMPLATE_KEY` ile şifreli tutuluyor, bu yüzden iki seçenekte de anahtar yönetimi belirleyici.
- **Seçenek:** Convex AB bölgesi (Dublin) Şubat 2026'dan beri tüm planlarda var; ücretli kullanım %30 pahalı. Ama mevcut deployment taşınamıyor; yeni deployment açılıp yedekten geri yüklenmesi gerekiyor. Bu da self-host kadar URL, mobil sürüm ve yeniden giriş işi demek. Kaynak: [ship.convex.dev/changelog/eu-region-hosting-dublin (6 Şubat 2026)](https://ship.convex.dev/changelog/eu-region-hosting-dublin)
- **Sonuç:** Veri TR şartı olmadığı için KVKK self-host lehine belirleyici değil. İki yolda da sözleşme ve bildirim ile aydınlatma metni gerekiyor; hukukçu teyidi önerilir.

---

## 6. Net öneri

**Açılış (8-10 Aralık) için: E yolu.** Mevcut Cloud deployment'ında kal ve ücretli plana geç. Taşıma yok.

1. **Bugün:** Free → **Starter** ya da **Pro**. Seçim ölçütü yedek:
   - **Pro ($25):** Günlük otomatik yedek ve e-posta desteği dahil; 50 GB I/O tamponu düzeltilmemiş ana sayfayı da karşılar.
   - **Starter:** Daha ucuz (~$1-18). Ama otomatik yedek yok. Starter seçilirse **gece `npx convex export` → Hetzner dışı şifreli depo** script'i şart; bugün hiç yedek yok ve bu açılıştan önce kapanmalı.
   - Kaynaklar: [backup-restore](https://docs.convex.dev/database/backup-restore) ("Periodic backups require a Convex Pro plan"; Free/Starter'da en çok 2 manuel yedek, 7 gün), [pricing](https://www.convex.dev/pricing).
2. **Harcama sınırı:**
   - Takım spending limit için "warning" kur, **"disable" kurma**. Disable, PDKS'yi gün ortasında kapatır.
   - Spending limit'in Starter'da açık olduğu dokümanda net değil; dashboard'da kontrol et. Kaynak: [teams](https://docs.convex.dev/dashboard/teams/teams).
   - **Dikkat:** "Development deployments do not receive email notifications". Canlı sistem dev deployment'ında olduğu için kullanım uyarı e-postası gelmeyebilir; kullanımı haftada bir elle kontrol et. Kaynak: [usage-limits](https://docs.convex.dev/production/usage-limits).
3. **Açılış haftası:** Ana sayfa yenileme düzeltmesini yayınla. Faturayı $18'den ~$1-5'e indirir ve self-host'ta da aynı CPU/disk yükünü azaltır.
4. **Ocak 2027 sonrası, isteğe bağlı:** Self-host hâlâ isteniyorsa **B (ayrı VM)** yolunu seç, mümkünse Postgres'le. 2-4 hafta paralel prova ve en az bir geri yükleme provası yap. Bu sürede 25 Kasım SQLite düzeltmelerinin "Latest" sürümlerde oturduğunu gör. **A (aynı sunucu) önerilmez.**

**Karar şu koşullarda değişir:**
- Cloud faturası düzenli olarak ayda ~$150-300'ü aşarsa: self-host'un altyapı + Emre zamanı maliyetini geçer. → B'yi değerlendir.
- Bir müşteri sözleşmeyle "kendi sunucunuz / bizim sunucumuz" isterse. → B ya da müşteri başına ayrı kurulum.
- Convex fiyat ya da şirket riski çıkarsa: lisans FSL olduğu için kod 2 yıl sonra Apache 2.0'a dönüyor ve self-host çıkış kapısı açık kalıyor.
- İkinci bir nöbetçi kişi bulunursa self-host'un işletme riski belirgin düşer.

**Bu raporun doğrulayamadıkları:**
- Starter'da spending limit'in olup olmadığı.
- Dev deployment'ın ücretli plandaki faturalanma ayrıntısı.
- Deployment bölgesi (URL'den çıkarım).
- 25 Kasım SQLite düzeltmelerinin hangi Docker imaj etiketinde olduğu.
- Pafta'nın gerçek kaynak kullanımı.

Ayrıca: canlı sistemin **dev** deployment'ında olması (yanlışlıkla `npx convex dev` ile ara kod gönderme riski, uyarı e-postası gelmemesi) plan seçiminden bağımsız bir risk. Prod deployment'a geçmek de bir URL değişikliği, bu yüzden açılıştan sonra ayrı planlanmalı.

## Kaynaklar (erişim 2026-11-28)
- https://docs.convex.dev/self-hosting
- https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md
- https://github.com/get-convex/convex-backend/blob/main/self-hosted/CHANGELOG.md
- https://github.com/get-convex/convex-backend/blob/main/self-hosted/advanced/upgrading.md
- https://github.com/get-convex/convex-backend/blob/main/self-hosted/advanced/postgres_or_mysql.md
- https://github.com/get-convex/convex-backend/releases
- GitHub issues: #495, #593, #563, #565, #519, #492, #639, #612, #622, #648, #608, #93, #358, #101, #628, #588, #271, #395 (github.com/get-convex/convex-backend/issues/N)
- https://news.convex.dev/self-hosting/ (13 Şubat 2025)
- https://convex-in-prod.dev/posts/self-hosted-roi-lessons-configuration/ (1 Eylül 2026)
- https://www.convex.dev/pricing
- https://docs.convex.dev/database/backup-restore
- https://docs.convex.dev/production/usage-limits
- https://docs.convex.dev/dashboard/teams/teams
- https://docs.convex.dev/production/state/limits
- https://ship.convex.dev/changelog/eu-region-hosting-dublin (6 Şubat 2026)
- https://status.convex.dev/incidents/7ttckbkcpjgf (8 Mayıs 2026, Free/Starter 1 sa 49 dk), https://pingoru.io/providers/convex/outage-history (Nisan 2026'dan beri 52 olay, son 90 günde 5)
- https://www.kvkk.gov.tr/Icerik/2053/Yurtdisina-Aktarim, https://www.kvkk.gov.tr/Icerik/8043/Standart-Sozlesme-Bildirim-Modulu-Hakkinda-Kamuoyu-Duyurusu
- Repo: [FREE_PLAN_2026-11-28.md](FREE_PLAN_2026-11-28.md), [SELF_HOST_PLAN_2026-11-28.md](SELF_HOST_PLAN_2026-11-28.md), [YUK_500_2026-11-27.md](YUK_500_2026-11-27.md), `.claude/orca-specs/self-host-review.md`
