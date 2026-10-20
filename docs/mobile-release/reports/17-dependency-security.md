# 17 — Kök npm bağımlılık güvenliği teslimi

19 Ekim 2026 · Yerel checkout · task_9c82c6b98da7

## Uygulanan değişiklik

Kök package.json/package-lock.json içindeki hedefli güvenlik güncellemeleri uygulandı. İlk kanıt dosyası ve yeniden çalıştırılan npm audit aynı **16 etkilenmiş paket: 2 critical, 8 high, 6 moderate** sonucunu verdi; son tam audit ve üretim bağımlılığı auditi **0 açık** döndürüyor. Bunlar paket/bağımlılık bulgusu sayılarıdır; 16 bağımsız CVE veya uygulamada 16 kanıtlanmış exploit anlamına gelmez.

- Değişen dosyalar: package.json, package-lock.json, bu rapor ve [npm-audit-final.json](../evidence/npm-audit-final.json). İlk [npm-audit.json](../evidence/npm-audit.json) korundu.
- Önceden koordinatörün eklediği convex-test **0.0.62** ve @edge-runtime/vm **5.0.0** korundu; mevcut ws/tmp/qs/uuid overrides değiştirilmedi. Diğer worker kaynak dosyalarına, mobil pubspec/native/generated dosyalara dokunulmadı.
- Yeni doğrudan ürün bağımlılığı, kaynak API değişikliği, codegen, migration, deploy, üretim mutasyonu, commit/push yok. Paket kilidi formatı 3 olarak korundu.
- Dispatch içindeki eski genel 09-backend-auth rapor yoluna yazılmadı; özel ownership talimatındaki 17-dependency-security raporu kullanıldı.

## Önce / sonra ve etkilenen kapsam

| Paket | Önce audit seviyesi | Kilitli sürüm önce → sonra | Etkilenen katman |
|---|---|---|---|
| @auth/core | critical | 0.37.4 → 0.41.3 | Convex/web auth runtime (Flutter binary paketi değil) |
| @convex-dev/auth | critical | 0.0.91 → 0.0.96 | Convex/web auth runtime |
| @vitest/mocker | moderate | 4.1.5 → 4.1.12 | Test geliştirme ortamı |
| baseline-browser-mapping | moderate | 2.10.38 → 2.11.29 | Babel/browser hedef araçları (dev) |
| brace-expansion | high | 5.0.6, 1.1.14, 2.1.0 → 5.0.12, 1.1.21, 2.1.7 | ExcelJS arşiv zinciri + lint araçları |
| browserslist | high | 4.28.2 → 4.29.4 | Babel/browser hedef araçları (dev) |
| dompurify | moderate | 3.4.11 → 3.4.17 | Web PDF/HTML export (jsPDF) |
| fflate | moderate | 0.8.2 → 0.8.3 | Web PDF export (jsPDF) |
| ip-address | high | 10.2.0 → 10.7.4 | Node MQTT / SOCKS zinciri |
| nanoid | high | 3.3.13 → 3.3.20 | PostCSS geliştirme zinciri |
| postcss | high | 8.5.15 → 8.5.31 | Web CSS build araçları |
| react-router | high | 7.17.0 → 7.18.4 | Web yönlendirme |
| react-router-dom | moderate | 7.17.0 → 7.18.4 | Web yönlendirme |
| sharp | high | 0.34.5 → 0.35.5 | Yerel ikon üretimi (dev) |
| source-map-js | high | 1.2.1 → 1.2.2 | PostCSS/Tailwind build araçları |
| vitest | moderate | 4.1.5 → 4.1.12 | Test geliştirme ortamı |

Her satırdaki advisory artık son audit sonucunda bulunmuyor. Ek kardeş @vitest paketleri birlikte 4.1.12 oldu; Sharp platform binary/libvips paketleri de 0.35.5/1.3.4 ailesine yükseldi. Browser hedef verileri ve auth paketlerinin zorunlu geçişli bağımlılıkları ebeveyn sürüm aralıkları içinde uzlaştırıldı.

### Kapatılan advisory kimlikleri

Aşağıdaki bağlantılar başlangıç auditinin kayıtlarıdır; ana paketlerde sürüm sınırları ayrıca maintainer duyurusu ve npm registry metadata ile doğrulandı.

| Başlangıç audit paketi | Advisory / taşınan bulgu |
|---|---|
| @auth/core | [GHSA-7rqj-j65f-68wh](https://github.com/advisories/GHSA-7rqj-j65f-68wh), [GHSA-xmf8-cvqr-rfgj](https://github.com/advisories/GHSA-xmf8-cvqr-rfgj), [GHSA-x445-f3h2-j279](https://github.com/advisories/GHSA-x445-f3h2-j279) |
| @convex-dev/auth | Üstteki bağımlılıktan taşınan bulgu |
| @vitest/mocker | [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) |
| baseline-browser-mapping | [GHSA-w5vr-8v7q-w6rv](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv) |
| brace-expansion | [GHSA-3jxr-9vmj-r5cp](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp), [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg), [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895), [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr), [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7), [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) |
| browserslist | [GHSA-c83g-rgw3-j3cx](https://github.com/advisories/GHSA-c83g-rgw3-j3cx), [GHSA-73wf-gq98-2v4g](https://github.com/advisories/GHSA-73wf-gq98-2v4g) |
| dompurify | [GHSA-55q2-fjhq-7xh7](https://github.com/advisories/GHSA-55q2-fjhq-7xh7), [GHSA-c2j3-45gr-mqc4](https://github.com/advisories/GHSA-c2j3-45gr-mqc4), [GHSA-6688-9rhm-gjv2](https://github.com/advisories/GHSA-6688-9rhm-gjv2) |
| fflate | [GHSA-px8p-9vwx-vf98](https://github.com/advisories/GHSA-px8p-9vwx-vf98) |
| ip-address | [GHSA-mwp4-54f8-5fhr](https://github.com/advisories/GHSA-mwp4-54f8-5fhr), [GHSA-4xrf-jv44-h6hh](https://github.com/advisories/GHSA-4xrf-jv44-h6hh), [GHSA-22jq-vg5j-6vgg](https://github.com/advisories/GHSA-22jq-vg5j-6vgg), [GHSA-rpw4-54j3-4h4q](https://github.com/advisories/GHSA-rpw4-54j3-4h4q), [GHSA-2vr4-cq9g-pvrc](https://github.com/advisories/GHSA-2vr4-cq9g-pvrc), [GHSA-j6r3-76f7-8jcv](https://github.com/advisories/GHSA-j6r3-76f7-8jcv), [GHSA-h3mg-xc3c-68pw](https://github.com/advisories/GHSA-h3mg-xc3c-68pw) |
| nanoid | [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv), [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) |
| postcss | [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp), [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) |
| react-router | [GHSA-wrjc-x8rr-h8h6](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6), [GHSA-h8fp-f39c-q6mh](https://github.com/advisories/GHSA-h8fp-f39c-q6mh), [GHSA-337j-9hxr-rhxg](https://github.com/advisories/GHSA-337j-9hxr-rhxg), [GHSA-chx6-hx7r-mcp5](https://github.com/advisories/GHSA-chx6-hx7r-mcp5), [GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2) |
| react-router-dom | Üstteki bağımlılıktan taşınan bulgu |
| sharp | [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj), [GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c), [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) |
| source-map-js | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) |
| vitest | [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) |

Bu teslim MOB-21 kapsamındaki kök JavaScript araç zincirinin bağımlılık güvenliği alt işini tamamlar. NET-F01 gibi mobil hata protokolü veya MOB-02 çalışan oturum iptali bulgularını bu bağımlılık değişikliği tek başına kapatmaz; bunların kaynak/test teslimleri ilgili sahiplerdedir.

## Uyumluluk kararları ve resmi kaynaklar

**Auth:** @convex-dev/auth 0.0.91 → 0.0.96 için manifest minimumu yükseltildi. npm view çıktısında 0.0.96; React ^18.2.0 || ^19.0.0-0, Convex ^1.17.0 ve @auth/core ^0.41.1 kabul ediyor. Kilitte gerçekten **@auth/core 0.41.3** var; yalnız Convex Auth sürümünü değiştirmekle yetinilmedi. [Auth.js normalizer duyurusu](https://github.com/nextauthjs/next-auth/security/advisories/GHSA-7rqj-j65f-68wh) ve [provider cookie duyurusu](https://github.com/nextauthjs/next-auth/security/advisories/GHSA-x445-f3h2-j279) düzeltilmiş sürümü 0.41.3 olarak belirtiyor. npm auditte critical olan normalizer kaydı maintainer sayfasında High etiketli; bu rapordaki sayım npm registry sonucudur.

[Convex Auth changelog](https://github.com/get-convex/convex-auth/blob/main/CHANGELOG.md) 0.0.94 core peer yükseltmesini, 0.0.95 başarısız code-only sign-in/OTP davranış düzeltmesini ve 0.0.96 refresh-token/verifier tablo kimliği ile debug redaksiyonu düzeltmelerini açıklıyor. Mevcut Password, convexAuth, authTables, getAuthSessionId/getAuthUserId, invalidateSessions/modifyAccountCredentials ve React provider/action hook exportları import smoke kontrolünde mevcut. Kaynak uyumluluğu için invites regresyonları geçti; canlı login/refresh kanıtı değildir.

**Router:** ^7.15.0 aralığı yerine güvenli tabanı belirten ^7.18.4 yazıldı; router/dom ikisi 7.18.4 çözüldü. [Maintainer RSC duyurusu](https://github.com/remix-run/react-router/security/advisories/GHSA-qwww-vcr4-c8h2) 7.x düzeltme sınırını 7.18.2 olarak verir ve bu özel açığın unstable RSC API kullananları etkilediğini söyler. Audit ayrıca SPA link/route matching bulguları da içerdiği için yalnız RSC kullanılmadığı gerekçesiyle güncelleme atlanmadı.

**Sharp:** 0.34.5 → 0.35.5 bilinçli 0.x uyumluluk sınırı geçişidir. Repo kullanımı yalnız scripts/fix_app_icon.mjs içindeki SVG Buffer → png({compressionLevel:9}) → toFile akışıdır. [0.35.0 sürüm notlarındaki](https://sharp.pixelplumbing.com/changelog/v0.35.0/) kaldırılan deprecated seçenekler bu akışta kullanılmıyor; [librsvg duyurusu](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w) son düzeltme sınırını 0.35.5 olarak veriyor. Gerçek mevcut betik yalnız OUT hedefi /tmp dosyasına çevrilerek çalıştırıldı: PNG 1024×1024, köşe RGB [160,0,42], 74.969 beyaz piksel; Sharp 0.35.5 / libvips 8.18.7. Mobil asset değiştirilmedi.

**Araç zinciri:** Yerel Node **22.22.3** ve npm **10.9.8** kullanıldı. npm 10, PostCSS/Vitest güncellemesinde Arborist loadPeerSet/edgesOut hatası verdi; peer doğrulamasını force/legacy-peer-deps ile kapatmak yerine npm registryden sürüm/engine metadata kontrolü sonrası geçici **npm 12.2.0** ile aynı hedefli install tamamlandı. Bu npm sürümü Node ^22.22.2 || ^24.15.0 || >=26.0.0 kabul ediyor; global npm kurulmadı. npm 12 bazı install scriptlerini varsayılan politikasıyla engelledi; genel allowScripts istisnası eklenmedi. Mevcut native Sharp ve Vitest yürütmesi başarılı; temiz ortam restore ve genel build koordinatörün kapısıdır.

Kök engines.node önceki >=20.0.0 beyanıyla bırakıldı; bu beyan bütün tooling için gerçek alt sınır garantisi değildir: Sharp >=20.9.0, mevcut Vite ^20.19.0 || >=22.12.0, mevcut ESLint ^20.19.0 || ^22.13.0 || >=24 gerektirir. Bu teslimin doğrulama ortamı Node 22.22.3'tür.

## Çalıştırılan komutlar ve sonuçlar

- npm audit --json: başlangıç 16 bulgu (yeniden doğrulandı), son 0; son ham JSON kanıtı yazıldı.
- npm audit --omit=dev --json: 0 açık, exit 0. Bu komutun kapsamının npm davranışı için [resmi audit belgesi](https://docs.npmjs.com/cli/v11/commands/npm-audit/) incelendi.
- npm view @convex-dev/auth@0.0.96 version peerDependencies dependencies engines --json; @auth/core@0.41.3, sharp@0.35.5, react-router-dom@7.18.2 ve npm version/engine sorguları: registry metadata doğrulandı.
- npm install '@convex-dev/auth@^0.0.96' 'react-router-dom@^7.18.2': başarılı.
- npm install --save-dev 'sharp@^0.35.5': başarılı.
- npm update baseline-browser-mapping brace-expansion browserslist dompurify fflate ip-address nanoid source-map-js: başarılı; sadece adı verilen geçişli güvenlik paketleri hedeflendi.
- npm update postcss vitest ve önceki toplu deneme/npm 10 install: Arborist edgesOut hatasıyla başarısız; başarılıymış gibi raporlanmadı.
- npm exec --yes --package npm@12.2.0 -- npm install --save-dev 'postcss@^8.5.23' 'vitest@^4.1.11': başarılı, çözülen güvenli sürümler 8.5.31 ve 4.1.12.
- npm ls --all: exit 0; eksik/invalid peer bildirilmedi. Manifest dependency/devDependency aralıkları kilidin root metadata alanlarıyla birebir eşleşiyor (Node assert kontrolü).
- node_modules/.bin/vitest run src/lib/routeMeta.test.ts src/lib/reports/pdf.test.ts src/lib/reports/export.test.ts: gerçekten mevcut **2 dosya / 6 test** geçti; export.test.ts adlı dosya bulunmadığı için üçüncü test dosyası çalıştı iddiası yok.
- node_modules/.bin/vitest run convex/invites.test.ts: **1 dosya / 49 test** geçti. Toplam bu workerın çalıştırdığı mevcut testler **55**.
- Auth.js gerçek paket smoke regresyonu: bozuk % ve %E0%A4%A Bearer değerleri null dönüyor; geçerli sentetik raw değer kontrolü geçiyor. Mevcut Convex Auth server/React/Password export kontrolleri geçti.
- Gerçek ikon betiğinin /tmp çıktısıyla Sharp smoke kontrolü geçti (yukarıdaki ölçüler).
- git diff --check -- package.json package-lock.json: temiz.

Kalıcı kaynak test dosyası ownership kapsamında yoktu; kaynak test eklenmedi. Aşağıdaki bağımsız paket regresyon kodu tekrar çalıştırılabilir (gerçek token/kimlik bilgisi veya ağ çağrısı yok):

```js
import assert from 'node:assert/strict';
import { getToken } from '@auth/core/jwt';
for (const value of ['%', '%E0%A4%A']) {
  assert.equal(await getToken({
    req: new Request('https://fixture.invalid', {
      headers: { authorization: 'Bearer ' + value },
    }),
    raw: true,
  }), null);
}
```

## Açık sınırlar ve koordinatöre teslim

Kilit kararlılığı koordinatör ve auth sahibine ayrıca bildirildi; bundan sonra paket değişikliği yapılmadı. Tam Vitest, TypeScript, genel web build ve auth son kabul kapıları koordinatör/ilgili sahipte; bu rapor bu kontrolleri çalışmış saymaz. Flutter/Dart komutu, pub get, codegen, Gradle/Pod/build veya fiziksel cihaz testi çalıştırılmadı. Kök npm ağacı Flutter binary içeriğinin listesi değildir: auth backend/web, router web, Sharp/Vitest/PostCSS ise geliştirme araçlarıdır. Android/iOS signing, cihaz/panel QA ve mağaza yayını bu bağımlılık teslimiyle tamamlanmış olmaz.

Son registry auditinde kalan bilinen advisory **yok**; sıfır audit sonucu bilinmeyen açıkların yokluğu veya uygulamanın tüm güvenlik kontrollerinin tamamlandığı iddiası değildir. Üretime değişiklik gönderilmedi; rollback gerekirse yalnız bu teslimin package.json/package-lock.json farkları birlikte geri alınmalıdır, önceki convex-test/edge-runtime eklemeleri ve diğer worker değişiklikleri korunmalıdır.
