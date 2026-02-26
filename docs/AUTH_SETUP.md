# NGS Access - Auth Kurulumu (Convex Skill Uyumlu)

## Mevcut Yapı

### 1. Convex Auth (@convex-dev/auth)
- **Provider:** Password (email + şifre)
- **Schema:** authTables + users override (role, photoUrl, fullName)
- **Roller:** super_admin, project_admin, project_user

### 2. HTTP Routes
`convex/http.ts` içinde `auth.addHttpRoutes(http)` ile:
- `/.well-known/jwks.json`
- `/.well-known/openid-configuration`
- `/api/auth/*` (sign in/out callback)

### 3. Auth Helpers (`convex/lib/auth.ts`)
| Fonksiyon | Açıklama |
|-----------|----------|
| `getCurrentUser` | Kimliği doğrulanmış kullanıcı (yoksa hata) |
| `getCurrentUserOrNull` | Opsiyonel auth |
| `getProjectIdsForUser` | Kullanıcının erişebildiği projeler |
| `requireAdmin` | super_admin veya project_admin |
| `requireSuperAdmin` | Sadece super_admin |

### 4. Custom Functions (`convex/lib/customFunctions.ts`)
| Wrapper | Kullanım |
|---------|----------|
| `authedQuery` / `authedMutation` | Giriş zorunlu |
| `optionalAuthQuery` | Opsiyonel giriş |
| `adminQuery` / `adminMutation` | Admin yetkisi |
| `superAdminMutation` | Süper admin only |
| `authedAction` | Action için auth |

### 5. Environment Variables (Convex Dashboard)
- `CONVEX_SITE_URL` - Deployment URL (otomatik)
- `JWT_PRIVATE_KEY` - JWT imzalama (Convex Auth)
- `JWKS` - Public key (Convex Auth)
- `SITE_URL` - OAuth/magic link redirect (opsiyonel, sadece password için gerekmez)

## Checklist (Auth Skill)

- [x] Users table (authTables + custom alanlar)
- [x] `getCurrentUser` helper
- [x] `getCurrentUserOrNull` helper
- [x] `requireAdmin` / `requireSuperAdmin`
- [x] Auth HTTP routes (auth.addHttpRoutes)
- [x] Client: ConvexAuthProvider
- [x] Tüm korumalı fonksiyonlarda auth kontrolü (custom functions ile)
- [x] Net hata mesajları ("Giriş yapmanız gerekiyor", "Yetkiniz yok")

## Yeni Kullanıcı / İlk Giriş

@convex-dev/auth Password provider ile kayıt sırasında kullanıcı otomatik oluşturulur. Role ataması için:
- `users.setupUser` mutation (super_admin tarafından)
- `users.updateRole` mutation (super_admin tarafından)
