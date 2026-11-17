# Plan — PDKS audit kalan 4 madde (2026-11-17)

Kaynak: PDKS Vardiya ajanının audit'i (2026-11-14). Madde 1 ("Veri bekleniyor") cd4ae3df ile CANLI.

## Checklist

### Faz A · Mola kuralı (~1,5 sa, worker Codex sol high)
- [ ] A1 Planlı mola, çalışma aralıklarıyla örtüştüğü kadar düşülsün; ara çıkışta dışarıda geçen süre tekrar kesilmesin
      (bugün: 11:00–11:01 çıkış bütün 12:00–13:00 molasını siliyor — `convex/lib/pdksDay.ts:164-187`, `singleVisitBreak`)
- [ ] A2 Tanımsız mola: iki hesap yönteminde aynı kural (bugün legacy=yasal mola 60 dk, eachPunch=0)
- [ ] A3 Testler + tam vitest; denetim (Claude opus)

### Faz B · Eski hesap yolunu ortak motora bağla (~1 sa, worker Codex sol medium)
- [ ] B1 `convex/dashboard.ts:467` yıllık fazla mesai `netWorkMinutes` yerine ortak PDKS motoru (`computePdksDay`) kullansın
- [ ] B2 Kıyas testi: planlı moladan sonra başlayan 270 dk çalışma iki yolda da 270

### Faz C · Eksik kayıt kuralına tarihli geçiş (~1 sa)
- [ ] C1 Eski mod tek okutmayı giriş sayıyor (`convex/lib/pdksEvidence.ts:44-55`); yeni giriş–çıkış kuralı (requirements) incelemeye ayırıyor
- [ ] C2 Projeleri belirlenen tarihten itibaren yeni kurala geçir (altyapı tarihli politika destekliyor; geçmiş korunur)

### Faz D · Bordro dönem kapatma (~3 sa, worker Codex sol high + denetim)
- [ ] D1 Şema: `payrollPeriods` (proje, ay, kapanış zamanı/kişi, satır anlık görüntüsü)
- [ ] D2 Kapalı dönemde bordro/puantaj anlık görüntüden okunur; sonradan gelen okutma "fark incelemesi" listesine düşer
- [ ] D3 UI: PDKS'de "Dönemi kapat / yeniden aç" + fark listesi
- [ ] D4 Testler + denetim

### Kapanış
- [ ] Kapılar (tsc, eslint, tam vitest, node-leak) → commit → Emre onayıyla yayın

## Kararlar (Emre 2026-11-17)
- A1 düzeltilmiş mola kuralı GEÇMİŞ TÜM DÖNEMLERE uygulanır.
- A2 tanımsız mola: iki yöntemde de YASAL MOLA (İş K. 68: ≤4 sa 15 dk, 4–7,5 sa 30 dk, >7,5 sa 60 dk); ara çıkışta dışarıda geçen süre bundan düşülür.
  (11 Kas kararı "tanımsız molaya varsayılan eklenmez" bununla DEĞİŞTİ.)
- C eski (legacy) kuraldaki projeler 2026-11-18'den itibaren requirements kuralına geçer; geçmiş korunur.
- D dönemi proje yöneticisi (admin) kapatır, YALNIZ super_admin yeniden açar; her işlem denetim kaydına.
