# Proje Kuralları

## Tip Güvenliği

- TypeScript `strict: true`. `any` ve `as any` **eslint error** ile yasaklı. Bilinmeyen veri için `unknown` + narrowing.
- Convex query/mutation sonuçları frontend'de `any[]`'a açılmaz. Doğrudan `useQuery` sonucu kullanın veya `FunctionReturnType<typeof api.X.Y>` ile tipleyin.
- Form payload'ları için `z.infer<typeof schema>` tercih edin.
- `!` non-null assertion yerine optional chaining + erken return kullanın.

## Convex Backend

- Handler'lar schema field isimlerini **olduğu gibi** (camelCase) döner. Snake_case yeniden mapping yapılmaz — Supabase'den kalan `first_name`, `device_serial`, `group_members` tarzı isimler artık yasaklı.
- `db.get`'ten dönen `Doc | null` array'lerinde tip korunur: `filter((p): p is NonNullable<typeof p> => p !== null)` kullanın, `filter(Boolean)` değil.

## Naming

- Convex tabloları + alanları camelCase.
- React form alanları (react-hook-form `name=`) o formun zod schema'sıyla bağlı; Convex shape'iyle ilişkisi yok, dokunulmaz.

## Lint Çalıştırma

- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` — TS hata 0.
- `node_modules/.bin/eslint src convex` — `no-explicit-any` 0 olmalı; `no-unused-vars` warn (zorunlu değil).

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
