# P4 triage — QA (`/tmp/pub-p4/QA.md`) + kod denetimi (`/tmp/pub-p4/REVIEW.md`) — 2026-10-19

Kaynak: Codex QA (168 ekran, Lighthouse 4 koşum) + Claude sonnet kod denetimi (HEAD ↔ çalışma kopyası). Toplam 21 bulgu → 17 kabul, 4 ret.

## Koordinatörün uyguladıkları (W2, dispatch öncesi; tsc 0 · eslint 0 · vitest 18/18)
- **Q-01 (P-34) koyu tema sızıntısı** → `src/hooks/usePublicTheme.ts` (`useLayoutEffect` ile `.dark`'ı boyamadan önce kaldırır) +
  `AuthShell`, `StatusScreen`, `LandingPage` çağrısı. Gerçek senaryo: Ayarlar'dayken çıkış → `GeneralSettings.tsx:25` cleanup'ı
  `Layout` cleanup'ından SONRA çalışıp `.dark`'ı geri koyuyordu (React silme sırası ebeveyn → çocuk).
- **R-07 rota değişiminde kaydırma** → `src/App.tsx` `AppContent`: hash yoksa `window.scrollTo(0, 0)`.

## W3 paketleri
| Paket | Worker | Bulgular |
|---|---|---|
| **perf** | Codex `gpt-6-astra high` (kök sebep) | Q-02 |
| **landing** | Codex `gpt-6.1-sol medium` | Q-07, R-02, Q-05 (landing/header/footer), R-08, R-09 |
| **auth** | Codex `gpt-6.1-sol medium` | R-01, R-04, R-05, R-06, R-11, Q-03, Q-04=R-03, Q-05 (auth/durum), Q-09, Q-10, eksik testler |

## Kabul
| # | Önem | Özet | Paket |
|---|---|---|---|
| Q-02 | 🟠 | Mobil Lighthouse landing 66 / login 64 (<90): `dist/index.html` entry'si `excel-pdf` (1,33 MB) + `charts` (357 KB) modulepreload ediyor; ~508 KiB kullanılmayan JS | perf |
| R-01 | 🟠 | `Login.test.tsx:5` pafta reposunun mutlak yolundan playwright import ediyor → başka makinede/CI'da 5 test kırılır | auth |
| Q-03 | 🟡 | Auth skip-link Enter → odak BODY (`main` odaklanamıyor) | auth |
| Q-04 = R-03 | 🟡 | Durum ekranı skip-link `#status-content` hedefliyor, `main` içinde, odak taşınmıyor | auth |
| R-04 | 🟡 | CheckIn backend reddi (süresi dolmuş/geçersiz kod) "güncel QR'ı tarayın" önerisini göstermiyor | auth |
| R-05 | 🟡 | UserSetup `type==='reset'` başlığı "Davet bağlantısı geçersiz." — açıklamayla çelişiyor | auth |
| R-06 | 🟡 | Register (+ Login) genel hata yalnız e-posta alanına bağlı; HEAD'de 5 alan `aria-describedby` + `aria-invalid` | auth |
| Q-05 | 🟡 | 390'da bağımsız bağlantılar <44px (logo 30-41px, footer nav 22px, "Ana sayfa" vb.). Cümle içi bağlantı (WCAG 2.5.8 inline istisnası) hariç | landing + auth |
| Q-07 | 🟡 | `index.html` description/og/twitter ≠ `marketingFacts.heroDescription` (P-03 tam kapanmadı) | landing |
| R-02 | 🟡 | Landing aynı bölüm bağlantısına 2. tıklamada kaydırma yok (`[hash]` bağımlılığı) | landing |
| Q-09 | ⚪ | Register 390'da Ad/Soyad mockup'ta iki sütun, uygulamada tek | auth |
| Q-10 | ⚪ | Public form/durum birincil eylem 500 ağırlık; tasarım 600 | auth |
| R-08 | ⚪ | `marketingFacts` ölü export'ları (auth metinleri sayfalarda sabit) | landing |
| R-09 | ⚪ | Kullanılmayan varyantlar: `PublicHeader variant="auth"`, `PublicFooter variant="compact"`, Logo varyantları (yalnız `src` genelinde 0 kullanım varsa) | landing |
| R-11 | ⚪ | `VerifyEmail.tsx:21,43` `expired` gölgeleme | auth |
| Test | — | CheckIn (başarı yalnız backend success, `locationRecorded` false metni, belirsiz sonuçta tekrar düğmesi yok, İstanbul saati), VerifyEmail dalları, UserSetup existing modu, `usePublicTheme` | auth |

## Ret
| # | Neden |
|---|---|
| Q-06 | Reduced-motion'da 0.01ms geçiş standart teknik (hareket fiilen kapalı); `transition:none` bazı `transitionend` dinleyicilerini bozabilir |
| Q-08 | `dist` eşleşmeleri oturumlu uygulamanın meşru hata/gizlilik/denetim metinleri; pazarlama iddiası değil. Kapı public kaynaklarda zaten 0 |
| R-10 | `--public-shot-shadow` rgba'sı DESIGN_PUBLIC'te tanımlı tek gölge; tema değişimi kapsam dışı |
| R-09 (kısmi) | Logo varyantları uygulama kabuğunda kullanılıyorsa dokunulmaz |

## Ertelenen (bu commit dışı)
QA'nın ulaşamadığı dallar: `user.verified=true` sonrası "Yönetim alanına geç" CTA'sı, AdminSetup `hasAdmin===true && isLoading` ara dalı, geolocation API'si olmayan tarayıcı. SHL-18/23/24/26 backend.
