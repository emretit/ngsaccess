# Supabase → Convex Migration Planı

Bu dokümanda ngsaccess projesinin Supabase'den Convex'e geçişi için detaylı plan bulunmaktadır.

---

## Mevcut Supabase Kullanımı Özeti

| Özellik | Kullanım Yeri | Dosya Sayısı |
|---------|---------------|--------------|
| **Auth** | Giriş, kayıt, çıkış, rol yönetimi | authService, AuthProvider, useAuthState |
| **Database** | 30+ tablo (PostgreSQL) | 40+ dosyada supabase.from() |
| **Storage** | Profil/çalışan fotoğrafları | ProfilePhoto, usePhotoUpload |
| **Edge Functions** | set-employee-password, send-employee-setup-email, send-user-setup-email, generate-pdf, execute_query | 5 adet function |
| **Realtime** | Kart okumaları canlı güncelleme | CardReadings.tsx |
| **RPC** | is_super_admin, execute_query | authService, naturalLanguageService |

---

## Supabase vs Convex Karşılaştırması

| Özellik | Supabase | Convex |
|---------|----------|--------|
| **Veritabanı** | PostgreSQL (ilişkisel) | Document-relational (JSON docs) |
| **Auth** | Supabase Auth (built-in) | Convex Auth (beta) veya Clerk/WorkOS |
| **Query** | supabase.from().select() | ctx.db.query() + indexes |
| **Realtime** | supabase.channel() | useQuery() otomatik realtime |
| **Functions** | Edge Functions (Deno) | Mutations, Queries, Actions |
| **Storage** | Supabase Storage | Convex File Storage |
| **RLS** | Row Level Security | Fonksiyon içinde auth kontrolü |

---

## Temel Farklar (Dikkat Edilmesi Gerekenler)

1. **Schema Dönüşümü**: PostgreSQL tabloları Convex document schemasına dönüştürülecek. `id: number` yerine `_id: Id<"tablename">` kullanılacak.

2. **Auth**: Convex Auth (beta) email/password destekliyor – mevcut flow ile uyumlu. Alternatif: Clerk gibi harici provider.

3. **İlişkiler**: PostgreSQL foreign key'ler → Convex'te `ctx.db.get(id)` ile manuel join veya embedded references.

4. **Edge Functions**: Her biri Convex mutation veya action'a dönüşecek.

---

## Migration Stratejisi: Fazlı Geçiş

### Faz 1: Convex Kurulumu ve Schema (1-2 gün)
- [ ] Convex projesi oluştur (`npx convex dev`)
- [ ] Convex Auth kurulumu (email/password)
- [ ] Temel schema tanımları (projects, users, employees...)
- [ ] Projeyi Convex + Supabase ile paralel çalışacak şekilde yapılandır

### Faz 2: Auth Migrasyonu (1 gün)
- [ ] Convex Auth ile login/signup/signout
- [ ] users tablosu Convex'e taşınması
- [ ] AuthProvider'ı Convex Auth'a geçirme
- [ ] user_projects ilişkisi

### Faz 3: Temel Modüller (2-3 gün)
- [ ] **Projects** – CRUD, project listesi
- [ ] **Employees** – CRUD + foto upload (Convex file storage)
- [ ] **Departments** – Hiyerarşik yapı
- [ ] **Devices, Zones, Doors** – Erişim kontrolü altyapısı

### Faz 4: Access Rules ve PDKS (2-3 gün)
- [ ] access_rules, group_members, group_devices
- [ ] card_readings (realtime subscription)
- [ ] pdks_records
- [ ] RPC fonksiyonları → Convex mutations (check_employee_device_access vb.)

### Faz 5: Ayarlar ve Yardımcı Modüller (1-2 gün)
- [ ] general_settings, mail_settings, notification_settings
- [ ] shifts, positions, companies, leave_requests vb.
- [ ] AI chat + execute_query → Convex action

### Faz 6: Edge Functions → Convex Actions (1-2 gün)
- [ ] set-employee-password → Convex mutation
- [ ] send-employee-setup-email → Convex action (Resend/SMTP)
- [ ] send-user-setup-email → Convex action
- [ ] generate-pdf → Convex action (Puppeteer veya API)

### Faz 7: Veri Migrasyonu ve Cutover
- [ ] Mevcut Supabase verilerini export et
- [ ] Convex'e import script'leri
- [ ] Supabase client çağrılarını kaldır
- [ ] Test ve production deploy

---

## Tahmini Süre

- **Minimum (MVP)**: ~1-2 hafta (temel CRUD + auth)
- **Tam geçiş**: ~3-4 hafta (tüm modüller + edge functions + veri migrasyonu)

---

## Sonraki Adım: Convex'i Çalıştırma

Aşağıdaki adımları sırayla uygula:

### 1. Convex projesini başlat

```bash
npx convex dev --once --configure=new
```

Bu komut:
- Tarayıcıda Convex/GitHub ile giriş isteyecek
- Yeni bir Convex projesi oluşturacak
- `convex/_generated/` klasörünü ve `.env.local` dosyasını oluşturacak

### 2. Uygulamayı Convex ile çalıştır

```bash
npm run dev
```

Ayrı bir terminalde (veya package.json script'ine ekleyerek):

```bash
npx convex dev
```

`npx convex dev` arka planda schema ve fonksiyonları Convex bulutuna senkronize eder.

### 3. Convex Provider'ı App'e ekle

Migration sırasında Convex'i Supabase ile **paralel** kullanabilirsin. `App.tsx` içinde `ConvexProvider`'ı en dışa ekle:

```tsx
import { ConvexProvider, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

// App component'inde, QueryClientProvider'ın içine:
<ConvexProvider client={convex}>
  <AuthProvider>
    ...
  </AuthProvider>
</ConvexProvider>
```

`.env.local` dosyasında `VITE_CONVEX_URL` değişkeni Convex tarafından otomatik eklenir.

### 4. İlk Convex query'ini dene

Örnek: `src/pages/Index.tsx` veya yeni bir sayfada:

```tsx
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

const projects = useQuery(api.projects.list);
```

---

## Oluşturulan Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `convex/schema.ts` | Tüm tabloların Convex schema tanımı |
| `convex/projects.ts` | Projeler için örnek query/mutation |
| `convex/tsconfig.json` | Convex TypeScript config |
