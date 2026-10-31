# ADR-0001: Teknoloji Stack'i

- **Durum:** Önerilen — kullanıcı onayı bekliyor
- **Tarih:** 2026-10-30

## Bağlam

Minimalist, hızlı, erişilebilir bir yazılım mühendisi portfolyosu. Gerçek backend (admin paneli, blog, proje yönetimi, GitHub senkronizasyonu, iletişim formu) gerekiyor. Ayrı bir backend servisi gerektiren bir gereksinim yok.

## Karar

| Katman | Seçim |
|---|---|
| Framework | Next.js (App Router), React, TypeScript (`strict`) |
| Stil | Tailwind CSS + özel design system; admin için seçili shadcn/ui bileşenleri |
| Animasyon | CSS transition + Motion for React (yalnızca gerektiğinde). GSAP ve Three.js yok |
| Backend | Next.js Route Handlers + Server Actions, sunucu tarafı validation (Zod) |
| Veritabanı | PostgreSQL (yönetilen) + Prisma |
| Auth | Auth.js (veya bakımı süren eşdeğeri) |
| Test | Vitest, React Testing Library, Playwright |
| Deploy | Vercel (alternatif değerlendirilebilir), GitHub Actions |

Kesin sürümler kurulum sırasında güncel kararlı sürümler ve uyumluluk kontrol edilerek belirlenir; burada sabitlenmez.

## Sürüm kararları (npm registry, 2026-10-30; Node v26.13.0, npm 11.20.0)

| Paket | Karar | Gerekçe |
|---|---|---|
| next | 16.4.3 | npm `latest`; engines `node >=20.9` |
| react, react-dom | 19.3.1 | Next peer aralığında |
| typescript | **6.0.3** (7.0.2 değil) | `typescript-eslint` 8.72.1 peer'ı `typescript <6.1.0`; TS 7 lint araçlarıyla uyumsuz. TS 7 sonra yeniden değerlendirilir |
| tailwindcss, @tailwindcss/postcss | 4.3.3 | `latest` |
| next-auth (Auth.js v5) | **5.0.0-beta.32** (kullanıcı onayladı) | `latest` etiketi eski v4; v5 beta Next 16 peer'ını destekliyor. Beta riski: sürüm sabitlenir, yükseltmeler ADR/test ile |
| prisma, @prisma/client | **7.10.1** (8.0.0-rc.29 değil) | `prisma` `latest` etiketi release candidate'e işaret ediyor; stabil 7.x seçildi. Kurulumda iki paketin sürümü aynı olmalı |
| zod | 4.6.7 | `latest` |
| vitest | 5.0.5 | engines: `node ^22.12 \|\| ^24 \|\| >=26` (Node 26 uygun) |
| @playwright/test | 1.64.1 | `latest` |
| eslint | 10.14.0 | typescript-eslint peer'ı destekliyor |
| motion | 14.9.0 | v1'de eklenmeyecek (CSS yeterli); gerekirse M8'de |

## Barındırma ve dosya depolama (kullanıcı kararı, 2026-10-31)

- **Hosting:** Vercel. **Dosya depolama (canlı):** Vercel Blob. Hobby planın limitleri ve ticari kullanım şartları M9'da güncel kaynaktan doğrulanacak.
- **Geliştirme:** yerel disk (`.uploads/`, git'e girmez). Depolama `src/lib/storage` arayüzü arkasında; Vercel Blob sürücüsü, hesap ve token olunca M9'da eklenip gerçek hesapla test edilecek (şimdi sahte sürücü yazılmaz).
- **Vercel sınırı:** Function istek gövdesi en fazla ~4.5 MB; yükleme limitleri buna göre (görsel ve PDF için 4 MB). Büyük dosya gerekirse istemciden doğrudan Blob'a yükleme değerlendirilir.
- **İçerik girişi:** gerçek projeler M8'den önce birlikte girilecek; M5'te test yalnızca yerel veritabanında işaretli örnek veriyle yapılır.

Node 26 `Current` hattında olabilir; deploy platformunun desteklediği Node sürümü M9'da doğrulanıp `engines` alanı buna göre ayarlanır.

## Alternatifler

- **Ayrı backend (Express/Nest):** Ek deploy ve bakım maliyeti; gereksinim yok. Reddedildi.
- **Drizzle ORM:** Hafif ve iyi bir seçenek; Prisma'nın migration ve araç desteği tercih edildi. Kullanıcı isterse yeniden değerlendirilir.
- **CMS (Sanity/Contentful):** Hosted bağımlılık ve maliyet; admin panelini kendimiz yazmak proje amacının parçası.

## Sonuçlar

- Tek deploy birimi, daha az operasyonel yük.
- Server Components varsayılan; client component sayısı minimumda tutulur.
- Bu karar değişirse yeni bir ADR yazılır, bu dosyanın durumu `Yerini aldı` yapılır.
