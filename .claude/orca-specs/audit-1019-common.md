## Ortak kurallar (audit-1019, koordinatör ngsaccess-cc)
- Repo `/Users/emreaydin/ngsaccess` (Convex backend `convex/` + React/Vite web `src/` + Flutter `mobile/`). HEAD `1a0c112`, origin/main `61cd264`.
  Push'lanmamış 3 commit = "Yayın 4": `04023d3` (dashboard getStats), `7059078` (KVKK rıza kartı, yalnız web), `1a0c112` (auth düşük açıklar).
- Canlı Convex = `notable-tern-4` (adı "dev" ama CANLI sistem). Web = https://ngsplus.app (Netlify, elle yayın; push yayın tetiklemez).
- **SALT-OKUMA.** Yazabileceğin TEK dosya kendi rapor dosyan (ve `/tmp/ceo-audit/<senin-adın>/` altında geçici dosyalar).
  YASAK: kaynak dosya düzenleme · git add/commit/push/stash/checkout/reset/clean · `convex dev|deploy|run|codegen|import|env set` · netlify · npm/npx install ·
  herhangi bir MCP aracı (Supabase dahil) · veritabanına yazma · tarayıcıda giriş/çıkış.
- Çalışma ağacı ortak: başka oturumların commit'siz dosyaları var (`mobile/**`, `.claude/handoff-*`). Dokunma, "düzeltme".
- Kişisel veri (e-posta, ad, şifre özeti, token) rapora ve terminal çıktısına ASLA yazılmaz; yalnız sayı/ID.
- Proje kuralları: `CLAUDE.md`; Convex kalıpları `convex/_generated/ai/guidelines.md`.
- Rapor Türkçe, her iddia `dosya:satır` ya da komut çıktısıyla kanıtlı, ≤150 satır. En üstte 3-5 satır özet + tek satır `Yayın 4'e engel: VAR/YOK` (+ sebep).
- `worker_done` özeti ≤10 satır, `--report-path` ile rapor yolunu ver.
