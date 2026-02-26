# Lovable + Cursor Hibrit Geliştirme Workflow

Bu doküman, NGS Access projesinde Lovable ve Cursor ile paralel geliştirme için rehber niteliğindedir.

## 1. Lovable Workspace + GitHub Sync Doğrulama

### Adımlar

1. **Lovable'da proje bağlama**
   - [Lovable](https://lovable.dev) platformuna giriş yapın
   - Workspace oluşturun veya mevcut workspace'e gidin
   - "Connect to GitHub" ile `ngsaccess` repository'sini bağlayın
   - Sync yönünü ayarlayın (Lovable ↔ GitHub)

2. **lovable-tagger doğrulama**
   - `vite.config.ts` içinde `componentTagger()` sadece development modunda aktif
   - `npm run dev` ile çalıştırdığınızda bileşenler otomatik tag'lenir
   - Lovable AI bu tag'leri kullanarak bileşenleri tanır

3. **Environment değişkenleri**
   - Lovable'da `VITE_CONVEX_URL` tanımlı olmalı (Convex deployment URL)
   - `.env.local` veya Lovable environment ayarlarından kontrol edin

## 2. Senkronizasyon Kuralları

| Kaynak | Hedef | Kural |
|--------|-------|-------|
| Lovable | GitHub | Lovable'dan sync öncesi Cursor'da commit yapın |
| Cursor | Lovable | Convex/schema değişikliklerini Lovable'a manuel aktarın |
| Convex | - | **Sadece Cursor'da** düzenleyin; Lovable Convex'e dokunmasın |

## 3. Lovable UI Geliştirme → Cursor Merge Testi

### Test Senaryosu

1. **Lovable'da UI değişikliği**
   - Yeni bir sayfa veya bileşen oluşturun
   - GitHub'a sync edin

2. **Cursor'da merge**
   ```bash
   git pull origin main
   # Conflict varsa çözün
   npm run build  # Build kontrolü
   npm run dev   # Çalıştırma testi
   ```

3. **Conflict çözümü**
   - `convex/**` dosyalarında conflict varsa Cursor versiyonunu koruyun
   - `src/components/auth/`, `src/hooks/` conflict'lerinde Cursor versiyonunu tercih edin
   - UI bileşenlerinde Lovable değişikliklerini koruyun

### Kritik Dosyalar (Sadece Cursor'da Düzenleyin)

- `convex/**/*`
- `src/convexClient.ts`
- `src/hooks/useAuthState.ts`
- `src/hooks/useProjectAccess.ts`
- `src/components/auth/AuthProvider.tsx`

## 4. Özet Checklist

- [ ] Lovable workspace GitHub'a bağlı
- [ ] lovable-tagger dev modunda çalışıyor
- [ ] VITE_CONVEX_URL ayarlı
- [ ] Merge conflict stratejisi belirlendi
- [ ] Convex dosyaları sadece Cursor'da düzenleniyor
