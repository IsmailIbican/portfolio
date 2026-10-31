# M9 log

Running record of the go-live work: what was done, problems met, how they were fixed. No secrets here.

## 2026-10-31

**Decisions**
- Hosting Vercel Hobby, database Neon, files Vercel Blob (public store `portfolio-media`, region fra1), e-mail Resend with the free `onboarding@resend.dev` sender, spam check Cloudflare Turnstile. Address `ismail-ibican.vercel.app`; no custom domain (paid, skipped).
- Private GitHub repo `IsmailIbican/portfolio`. The git author is GitHub's noreply address so no personal e-mail sits in the history.
- Content (`content-input/`) is not deployed; the user fills the live site through the admin panel. Sample content was never deployed.

**Done**
- Repo created and pushed; `content-input/`, `*.png`, `.vercel`, `secrets.production.env`, `.env.local`, `.uploads/` are git-ignored. Tracked files and history were scanned for secret patterns before every push.
- Vercel Blob driver (`src/lib/storage/blob.ts`): `STORAGE_DRIVER=blob`. The store host (`BLOB_PUBLIC_HOST`, validated) is allow-listed exactly in `next.config.ts` `remotePatterns` and the CSP `img-src`. `remove()` deletes only files in our own store. 6 new unit tests (SDK mocked).
- `scripts/upload-prod-env.mjs`: uploads 11 variables from `secrets.production.env` to the Vercel production environment through stdin; secrets are stored as Sensitive. `ADMIN_*` (seed only) and `DIRECT_URL` (migrations only) are not uploaded.
- Neon: `prisma migrate deploy` applied 4 migrations; seed created the empty `Profile`/`SiteSettings` rows and the admin account.
- `vercel.json` sets the framework to Next.js (the project was created as "Other").
- First production deploy from `main`: build Ready (46 s).

**Verification (2026-10-31)**
- Before deploy: typecheck, lint clean; 130 unit tests pass; `next build` passes.
- Live smoke test: `/`, `/about`, `/projects`, `/tech-stack`, `/contact`, `/admin/login`, `/robots.txt`, `/sitemap.xml`, `/opengraph-image` return 200; `/admin` redirects (307) to `/admin/login`; `/uploads/...` returns 404 (local-only route). Headers present: CSP with nonce and the exact Blob host, HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy.
- **Not verified:** admin login on the live site, a Blob upload, the contact form with Turnstile and the Resend e-mail, integration tests against the new database (not run), Lighthouse on the live site.

**Live checks by the user (2026-10-31):** admin login works; contact form works with Turnstile; a test message arrived both by e-mail (Resend) and in the admin Messages page.

**Profile photo:** `avatarUrl` was stored but no public page rendered it. It now shows next to the About heading (`ProfilePhoto`, `isHostedImageUrl` allows only `/uploads/` and our Blob host, anything else is skipped). Verified live: the page contains the image, the optimizer answers 200 `image/jpeg`, and the Blob file loads. Blob upload from the admin is therefore confirmed in production. Unit tests: 134 pass.

**Problems met**
- `vercel link` rewrote `.env.local` (pulled Development variables) without being asked; the file was not read afterwards. Check it if local dev behaves oddly.
- `vercel git connect` failed until the user authorised the Vercel GitHub app for the private repo in the browser.

**Skipped on purpose (cost)**
- Custom domain; paid plans of any service.

**Open**
- Turnstile hostname list must include `ismail-ibican.vercel.app`.
- Live checks above; GitHub username in the profile; scheduled cleanup (messages, orphaned uploads) and GitHub sync via Cron; Playwright E2E; GitHub Actions CI.

## 2026-10-31 (devam): Cron, CI, E2E

**Zamanlanmış bakım** (`GET /api/cron/daily`, `vercel.json` 03:00 UTC, ayrıntı `docs/api-design.md`)
- `CRON_SECRET` ile korunur, tanımsızken her isteği reddeder (503). Üç adım paralel ve birbirinden bağımsız; biri başarısız olursa yanıt 500 olur ama diğerleri çalışır.
- Mesajlar 180 günden sonra silinir. Sahipsiz yüklemeler yalnızca `VERCEL_ENV=production` iken, depolama anahtarına göre karşılaştırılarak, 24 saat tolerans ve çalıştırma başına en çok 50 silme ile süpürülür. GitHub eşitlemesi profildeki kullanıcı adıyla yapılır.
- Güvenlik ve backend incelemesi yapıldı: kritik/yüksek bulgu yok. Düzeltilen orta bulgular: önizleme ortamının canlı Blob deposunu süpürme riski (ortam koşulu), ham URL metniyle eşleştirme (artık anahtarla), sahte "silindi" sayımı (`remove` artık gerçekten silindi mi bildirir), hata durumunda 200 dönmesi, süre sınırı, eksik testler. Kabul edilen düşük riskler: 24 saatten uzun açık kalan formda yüklenen dosyanın kaybı; v1.1 blog eklenince `referencedUploadUrls` genişletilmeli.
- `CRON_SECRET` üretimde tanımlandı ve yeniden dağıtım yapıldı: yetkisiz isteklere 401 dönüyor (canlıda doğrulandı; tanımsızken 503 dönüyordu). İlk gerçek çalışma 2026-11-01 03:00 UTC'de Vercel günlüğünden kontrol edilecek.

**CI** (`.github/workflows/ci.yml`): `checks` işi (typecheck, lint, unit, integration, build; PostgreSQL servisiyle) ilk çalışmada yeşil, 2 dk 45 sn. `e2e` işi eklendi (Chromium + `npm run test:e2e`) ve ilk çalışmada yeşil (2 dk 12 sn).

**E2E** (`tests/e2e`, Playwright + axe): 26 test, art arda iki çalıştırmada 26/26. Kapsam: herkese açık gezinme, 404, güvenlik başlıkları, korumalı admin, giriş (yanlış parola dahil) ve çıkış, proje oluşturma/yayın/silme, taslağın ziyaretçiden gizli kalması, iletişim formu (anında gönderimin reddi dahil) ve mesajın admin Messages'a düşmesi, WCAG 2.2 AA taraması (5 herkese açık sayfa ve giriş sayfası açık ve koyu temada, 6 admin sayfası açık temada).
- Karşılaşılan: Playwright sunucuyu veritabanı kurulumundan önce başlatır (hazır sayma adresi `/robots.txt` yapıldı); form en az 3 sn açık kalmadan gönderilemez (test bunu bekler); çıkış tıklanır tıklanmaz `/admin`'e gitmek yarış durumu yaratıyordu (yönlendirme beklenir).
- Test altyapısı notu: vitest `vi.fn` ile reddedilen bir mock sonucunu, test beklese bile başarısızlık sayıyor; ilgili testte düz fonksiyon kullanıldı.

**Henüz yapılmadı / doğrulanmadı:** cron'un üretimde gerçek çalışması, Lighthouse'un canlıda yeniden ölçümü, saha performansı.
