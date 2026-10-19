# P5 — kalan işler: audit sonucu + plan (2026-10-19)

Audit: `/tmp/pub-p5/AUDIT-flows.md` (Codex astra high; 7 KAPALI / 3 KISMEN / 2 AÇIK) + `/tmp/pub-p5/AUDIT-ui.md` (Codex sol medium; 10 Lighthouse koşumu).

## Checklist
- [x] A1 audit (2 salt-okur worker, release edildi)
- [x] A2 triage (bu dosya)
- [x] **W-qr** BİTTİ 14:20 (koordinatör kapısı: tsc 0 · eslint 0 · vitest 846/846; schema yalnız checkInTokens'a 2 opsiyonel alan; dosyalar convex/employeeCheckIn.ts(+test), convex/schema.ts hunk, src/pages/CheckIn.tsx(+test); Convex deploy gerekir) Codex sol medium task_c69fa5491634 / ctx_e9086a0073f9 — QR sonuç sözleşmesi (RR-04 + SHL-26), spec `.claude/orca-specs/pub-p5-fix-qr.md`, rapor `/tmp/pub-p5/fix-qr.md`
- [x] **W-ui** BİTTİ 14:30 (koordinatör kapısı: tsc 0 · eslint 0 · vitest 147/147; Playwright: /home ilk boyamada dark, /login + farklı kapsam + bozuk JSON → açık; dosyalar index.html, src/main.tsx, src/hooks/useDarkMode.ts, src/lib/themeBootstrap.ts(+test), src/pages/Register.tsx, src/components/ui/logo.tsx, src/components/public/{AuthShell,StatusScreen,PublicHeader,PublicFooter}.tsx) Codex sol medium task_6baa3753ef06 / ctx_875143888209 — koyu tema (RR-02) + RR-05 + RR-08, spec `.claude/orca-specs/pub-p5-fix-ui.md`, rapor `/tmp/pub-p5/fix-ui.md`
- [x] **W-sec** BİTTİ 15:20 (koordinatör kapısı: app+convex tsc 0 · eslint 0 · vitest 33/33; yeni hesap kriteri `verified===false && role===undefined && üyelik yok` — `convex/auth.ts` signUp profili rol üretmiyor, doğrulandı) — önceki: ÇALIŞIYOR (14:45) Codex astra high task_d48d57838129 / ctx_9a09d58ab537 — karar: mevcut hesabın rolü davetle ASLA değişmez (Emre → CEO oturumu, 2026-10-19); spec `.claude/orca-specs/pub-p5-fix-sec.md`, rapor `/tmp/pub-p5/fix-sec.md`
- [x] Denetim (Claude sonnet, task_2cd0f9fd0b79): commit'e engel YOK (kritik 0/yüksek 0/orta 1/düşük 5, `/tmp/pub-p5/REVIEW.md`); koordinatör R5-02'yi düzeltti (davet iptali lowercase + tümü)
- [x] Kapı (koordinatör 15:45): tsc app+convex 0 · eslint src convex 0 · vitest 1392/1392 · build OK → CEO oturumuna "hazır" + `/tmp/pub2-files.txt` (20 yol)
- [ ] Commit (CEO oturumu) → Convex deploy ÖNCE (NEW-01 canlıda) → web deploy — Emre onayı
- [ ] Sonraki iş (ayrı): R5-01 davet token'ı oluşturana dönüyor → link yalnız e-postayla (orta); R5-03..06 düşük
- (eski satır) Kapı (koordinatör) → commit (Emre onayı) → **Convex deploy önce** (`npx convex dev --once`, Emre onayı) → web deploy (Netlify CLI, Emre onayı)

## Kabul
| # | Önem | Özet | Paket | Convex deploy |
|---|---|---|---|---|
| **NEW-01** | 🔴 Yüksek (güvenlik) | `convex/invites.ts:116` `consume` public mutation, kimlik okumuyor; e-postayla bulduğu MEVCUT hesabın global rolünü `invite.role` ile eziyor + `verifyUser`. Project_admin, son super_admin'ın e-postasını project_user olarak davet edip kendisine dönen token'la rolünü düşürebilir; başka projedeki project_user'ı project_admin daveti ile tüm projelerinde yükseltebilir. `type:'reset'` da tüketiliyor. Koordinatör kodda doğruladı. | W-sec | Evet, backend önce |
| SHL-23 (kalan) | 🟡 | Davet ekranında proje adı/rol görünmüyor; backend reset reddi yok | W-sec | Evet |
| RR-04 | 🟡 | QR başarısızlık sonucu yalnız Türkçe `error` metni; frontend metinle eşliyor | W-qr | Evet (geriye uyumlu alan ekleme) |
| SHL-26 (kalan) | 🟡 | Kullanılmış token tekrar yanıtında `locationRecorded` yok → GPS'li başarılı kayıttan sonra yenilemede "Konum bilgisi eklenemedi"; çalışan silinmişse eski başarı "Çalışan bulunamadı"ya dönüyor | W-qr | Evet |
| RR-02 | 🟡 | Koyu tema kullanıcısında yenilemede açık tema yanıp sönmesi (boş HTML → PageFallback → "Sistem hazırlanıyor" → kabuk) | W-ui | Hayır |
| RR-05 | ⚪ | Register genel hatada 5 alanın hepsi `aria-invalid` | W-ui | Hayır |
| RR-08 | ⚪ | `logo.tsx` kullanılmayan `variant` prop'u | W-ui | Hayır |

## Kapalı / ret
| # | Neden |
|---|---|
| Login mobil LH 89 | Canlıda login mobil medyan **94,5**, landing **95** (yerel `vite preview` CDN'siz). Rota bazlı preload (Netlify rewrite) değmez |
| SHL-18, SHL-21, SHL-24, SHL-33 | KAPALI (audit kanıtı: `registrationFlow.ts:16`, `VerifyEmail.tsx:29`, `AuthProvider.tsx:67`, `AdminSetup.tsx:48`) |
| QA ulaşılamayan 3 dal | KAPALI (kod okuması: `UserSetup.tsx:91`, `AdminSetup.tsx:72`, `CheckIn.tsx:82`) |
| RR-09 | Projede DOM test ortamı yok (RTL/jsdom eklenmedi, karar 2026-10-19); dal P4 Playwright turunda görüldü |
| SHL-34 | Personel kurulum sonrası "uygulamayı aç" eylemi mobil dağıtım kanalı belli olunca (mağaza yok) |

## Emre kararı (W-sec için)
Mevcut bir hesap davetle başka projeye çağrılınca **global rolü** ne olsun? (rol bugün tek, global alan)
- **Öneri:** mevcut hesabın rolü davetle DEĞİŞMEZ; yalnız projeye üyelik eklenir. Yeni hesapta davetteki rol atanır. Rol değişikliği yalnız yönetici panelinden (`convex/users.ts` korumalı yol).
- Alternatif: yükseltmeye izin ver ama düşürmeye asla (project_user → project_admin olur; o kişi diğer projelerinde de yönetici olur).

## Deploy sırası
1. Convex (W-sec + W-qr backend) — eski web ile uyumlu (alan ekleme; consume artık oturum ister → eski web zaten signIn sonrası çağırıyor).
2. Web (Netlify CLI, `stop_builds` açık kalır) — yeni web, yeni alanları kullanır.
