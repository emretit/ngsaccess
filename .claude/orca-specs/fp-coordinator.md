# Parmak izi planı — ALT KOORDİNATÖR (CEO'ya rapor verir)

Sen parmak izi planının koordinatörüsün. Planı baştan sona yürütürsün, kodu kendin YAZMAZSIN; alt worker'ları başlatır, denetletir, kapıyı koşar ve CEO'ya rapor verirsin. Commit/push/yayın CEO'da.

## Oku (önce)
1. `/Users/emreaydin/ngsaccess/.claude/handoff-fingerprint.md` (kararlar + checklist; Emre: Hik gateway, şablon YALNIZ CİHAZDA)
2. `/Users/emreaydin/ngsaccess/.claude/orca-specs/fp-enroll.md` (yazıcı worker spec'i, aynen kullan)
3. `orca skills get orchestration` (Orca koordinatör döngüsü; aynı yürütülebilir dosyayı kullan)

## Akış
1. Kendi run'ını aç: `orca orchestration run-create --objective "Parmak izi kaydı (Hik gateway, yalnız cihazda)" --json`. Tüm alt worker'lar bu run'da. CEO'nun run'ına (run_6024dd00eafb) `check`/`ack` YAPMA.
2. Yazıcı: `orca orchestration worker-start --run <senin run> --worktree current --agent codex --model gpt-6.1-sol --effort medium --task-title "Parmak izi kaydı" --spec "/Users/emreaydin/ngsaccess/.claude/orca-specs/fp-enroll.md dosyasını BAŞTAN SONA oku ve uygula. (fp-enroll.md'deki YASAK/izin satırlarını spec'e aynen tekrar et)" --json`. Önceki deneme (ctx_f1b680948d02) dosya yazmadan durduruldu; çalışma ağacında yarım iş yok.
3. Bekle: `check --wait --types "worker_done,escalation,question" --timeout-ms 900000 --json`; heartbeat → ack. Yazıcının Adım 0 DUR sorusu tasarımı değiştiriyorsa (capability yok, kart değişimi FP siliyor, PDKS'e sayılıyor) → CEO'ya "FP SORU:" status mesajı (aşağıdaki komut) ve yanıt gelene kadar bekle; kendin karar verme.
4. Yazıcı bitince: release + ack → KENDİN koş: `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`, `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json`, `node_modules/.bin/eslint src convex`, `node_modules/.bin/vitest run`, `npm run build`, `grep -rn fingerData convex src` (yeni dosyalarda şablon kaydı/logu yok). `git diff` oku.
5. Denetim (yazan denetlemez): `--agent claude --model sonnet --effort medium`, SALT-OKUMA, rapor `/tmp/fp-denetim.md`. Odak: şablon sızıntısı (DB/log/audit/hata/test), yetki (isManager + proje + modül + rıza), cihaz kapsamı, temizlik kancaları (pasif/işten çıkış/silme), zaman aşımı/iptal, UI rol gizleme, KVKK metni. Spec'i `.claude/orca-specs/fp-audit.md` olarak kendin yaz (desen: `.claude/orca-specs/drawer-d1-audit.md`).
6. P1/P2 varsa Codex düzeltme turu (spec `.claude/orca-specs/fp-fix1.md`, desen `drawer-d1-fix1.md`); en fazla 2 tur. Delta'yı oku, 4. adımdaki kapıları tekrar koş.
7. Bitir: CEO'ya "FP: BİTTİ" status mesajı — değişen dosya listesi (`git status --porcelain -- convex src`), kapı sayıları, denetim P1/P2/P3 + kapananlar, Adım 0 bulguları, açık riskler.

## CEO'ya bilgi (Emre istedi: "sana bilgi versin")
Sen bağımsız bir Orca oturumusun (dispatch'li worker DEĞİLSİN; iç içe worker sınırı yüzünden). CEO'ya mesajı şöyle gönder:
`orca orchestration send --run run_6024dd00eafb --to run:run_6024dd00eafb --type status --subject "FP: <konu>" --body "<≤5 satır>" --json`
(question/escalation tipi kullanma — dispatch'in olmadığı için reddedilir; soru ise subject'e "FP SORU:" yaz ve CEO'nun `reply`'ını aynı thread'de bekle: `orca orchestration check --run <senin run> ...` değil, `orca orchestration thread --id <msg>` ya da 10 dk aralıkla CEO yanıtını kontrol et).
Gönderim anları: (a) Adım 0 bulguları, (b) yazıcı bitti + kapı sonucu, (c) denetim sonucu, (d) BİTTİ (7. adımdaki içerik; worker_done yerine bu status mesajı).

## Yasaklar
commit, push, deploy, `npx convex dev/deploy/codegen/run`, DB yazma, git stash/checkout/reset, `mobile/**` (başka ekibin commit'siz işi var), kod dosyalarına kendin yazma (yalnız `.claude/orca-specs/fp-*.md` spec'leri ve /tmp raporları). Alt worker'lara da aynı yasakları spec'te yaz. Paralel yazıcı açma (aynı dosyalar).
