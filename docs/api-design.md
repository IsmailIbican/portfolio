# API Tasarımı

Durum: taslak. Endpoint'ler implement edildikçe bu dosya güncellenir.

## Genel kurallar

- Her girdi sunucuda Zod ile doğrulanır; başarısız doğrulama `400`.
- Admin endpoint'leri her istekte oturum + rol kontrolü yapar (`401` oturum yok, `403` yetki yok). UI'da gizlemek yetki kontrolü yerine geçmez.
- Hata formatı: `{ "error": { "code": string, "message": string, "details"?: unknown } }`. İç hata ayrıntıları istemciye sızdırılmaz.
- Mutation'larda CSRF koruması (Auth.js/Next.js mekanizmaları + origin kontrolü).
- Herkese açık yazma endpoint'leri (contact) rate limit + anti-spam ile korunur.

## Auth (M3, uygulandı)

`GET/POST /api/auth/*` Auth.js'e aittir (csrf, callback, session, signout). Giriş formu server action kullanır (`loginAction`), çıkış `logoutAction`. Hatalı girişte `/admin/login?error=CredentialsSignin`. Oturum çerezi httpOnly, üretimde secure.

## Admin içerik yönetimi (M4, uygulandı): Server Actions

M4'te yönetim işlemleri REST endpoint'i yerine Server Action ile yapılır (form → action). Hepsi ilk iş `requireAdmin()` çağırır, girdiyi Zod ile doğrular, hata durumunda `FormState` döner (`{ ok?, message?, errors?, values? }`; yazılan değerler geri yansıtılır).

| Alan | Action'lar (`src/app/(admin)/admin/(protected)/<alan>/actions.ts`) |
|---|---|
| Profile + SiteSettings | `saveProfileAction` (tek form iki tekil satırı günceller) |
| Experience | `createExperienceAction`, `updateExperienceAction`, `deleteExperienceAction` |
| Education | `createEducationAction`, `updateEducationAction`, `deleteEducationAction` |
| Technologies | `createTechnologyAction`, `updateTechnologyAction`, `deleteTechnologyAction` (ad/slug çakışması alan hatası olarak döner) |

Doğrulama kuralları: URL alanları yalnızca `http(s)` (CV/foto için ek olarak `/` ile başlayan site yolu; `//` ve `\` reddedilir); tarihler `YYYY-MM`; bitiş başlangıçtan önce olamaz; boş metin `null` olur. Açıklamalar düz metin olarak render edilir (HTML yok). Taslak (`DRAFT`) kayıtlar public sorgulara girmez.

## Projeler ve medya (M5, uygulandı)

**Server Actions** (`src/app/(admin)/admin/(protected)/projects/actions.ts`, hepsi ilk iş `requireAdmin()`): `createProjectAction` (oluşturunca düzenleme sayfasına yönlendirir), `updateProjectAction`, `deleteProjectAction` (görselleri de siler), `deleteProjectMediaAction`. Slug boşsa başlıktan üretilir ve benzersiz yapılır (`my-app`, `my-app-2`); elle girilen slug çakışırsa alan hatası döner. Yeni projeler `DRAFT` başlar; `publishedAt` ilk yayında atanır ve yayından kaldırılıp tekrar yayınlansa da değişmez.

**`POST /api/admin/media`** (multipart; Route Handler çünkü dosya içerir):

| Alan | Açıklama |
|---|---|
| `target` | `project-media` (görsel + `projectId` + `alt` zorunlu), `avatar` (görsel), `cv` (PDF) |
| `file` | Dosya. Tür **içerikten** (magic bytes) belirlenir: JPEG, PNG, WebP, PDF. SVG reddedilir. En çok 4 MB |

Kontrol sırası: aynı origin (`Origin` başlığı yoksa/eşleşmiyorsa `403`) → oturumlu admin (`401`) → bildirilen boyut (`413`) → içerik doğrulama (`400`) → kayıt. Dosya adı sunucuda rastgele (`images/<uuid>.<ext>`). Yanıt: `{ url, id? }`. DB kaydı başarısız olursa yüklenen dosya geri silinir. `/api/admin/*` proxy eşleşmesinde olmadığı için bu route kendi içinde doğrular.

**`GET /uploads/[...path]`**: yalnızca yerel geliştirme deposu (`.uploads/`). `nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`, değişmez önbellek. Canlıda Vercel Blob kullanılacak (M9); bu route orada devre dışı kalır.

**Depolama:** `src/lib/storage` arayüzü (`put`, `remove`). `STORAGE_DRIVER=local` (varsayılan, yalnızca geliştirme) veya `blob` (Vercel Blob, herkese açık store; `BLOB_READ_WRITE_TOKEN` ve `BLOB_PUBLIC_HOST` gerekir). Blob sürücüsü yalnızca kendi host'undaki dosyaları siler; host `next.config.ts` `remotePatterns` ve CSP `img-src` içine tam adresle girer. Sürücü birim testlerle (SDK sahte) doğrulandı, gerçek store ile canlıda denenecek. Vercel Function gövde sınırı (~4.5 MB) nedeniyle yükleme limiti 4 MB.

## GitHub entegrasyonu (M6, uygulandı)

**İstemci** (`src/features/github/client.ts`): yalnızca `api.github.com`, salt okuma, yalnızca **herkese açık** veri: `GET /users/{kullanıcı}/repos` (özel repo hiçbir koşulda dönmez) ve `GET /repos/{sahip}/{ad}`. Kullanıcı adı ve repo adı GitHub kurallarına göre doğrulanır ve `encodeURIComponent` ile yola konur. Her istekte `User-Agent`, `X-GitHub-Api-Version`, `cache: "no-store"`, 8 sn zaman aşımı. Yanıtlar Zod ile doğrulanır: `html_url` yalnızca `https://github.com`, **özel (`private`) veya herkese açık olmayan (`visibility`) repolar kodda reddedilir** (listeden çıkarılır; tek repo istenirse "bulunamadı" gibi davranır), token'ın yetkisine güvenilmez. Yanıt `api.github.com` dışında bir adrese yönlendirilmişse reddedilir. İçe aktarılan başlık ve özet proje formunun sınırlarına (120/300 karakter) kısaltılır; aynı anda iki farklı repo aynı slug'ı üretirse yeniden denenir. Hatalar türlere ayrılır: `invalid-input`, `not-found`, `rate-limited` (sıfırlanma zamanıyla), `unavailable`, `invalid-response`.

**Token:** `GITHUB_TOKEN` isteğe bağlı, yalnızca sunucuda, yalnızca GitHub'a gider; hız sınırını 60/saat'ten yükseltir. Özel repo erişimi olmayan, ince ayarlı (fine-grained) bir token olmalı.

**Akış (admin → `/admin/github`):**
- *Load repositories* (`?browse=1`): profildeki kullanıcının herkese açık repolarını listeler (sayfa yüklenince 1-3 GitHub isteği; yalnızca bu bağlantıya tıklanınca).
- *Import*: repo adı formdan gelir, **veriler GitHub'dan sunucuda yeniden çekilir**; repo sahibi profildeki kullanıcı adıyla aynı olmalı. Taslak (`DRAFT`) proje oluşturur; başlık, özet, repo ve demo adresi ön doldurulur, sonra düzenlenir. Aynı repo ikinci kez eklenmez (harf büyüklüğüne bakılmaksızın, çift tıklamada da).
- *Sync now*: bağlı projelerin yalnızca GitHub'a ait alanlarını (yıldız, dil, son push, eşitleme zamanı) günceller; başlık/özet/öne çıkarma/yayın durumuna dokunmaz. Repo artık herkese açık değilse proje değiştirilmeden "kayıp" olarak raporlanır. Sonuç `SiteSettings.githubLastSyncAt/Error`'a yazılır (hata metni sabit ve güvenli).
- Sonuçlar sayfaya sabit kodlar (`?notice=`) ve sınırlı tamsayılarla (`synced`, `missing`) taşınır; serbest metin yansıtılmaz.

**Public:** Bağlı projelerde kart ve detay sayfasında tek satır: dil · yıldız · "Updated <ay yıl>". Ziyaretçi isteği GitHub'a **hiç gitmez**; veri veritabanındaki son eşitlemeden gelir. Zamanlanmış otomatik eşitleme (Vercel Cron) M9'da, Hobby sınırları doğrulanınca.

## İletişim formu (M7, uygulandı)

**`/contact`** sayfası + `submitContactAction` (herkese açık Server Action; Next'in Origin kontrolü vardır). Alanlar: ad (1-100, kontrol karakteri yok), e-posta, mesaj (10-5000). Sıra (ucuzdan pahalıya, her ret kasıtlı belirsizdir):

1. **Tuzak alanı** (`website`): doluysa sahte başarı döner, hiçbir şey kaydedilmez.
2. Zod doğrulaması (alan hataları gösterilir).
3. **Tek kullanımlık imzalı token** (`formToken`): sayfa verirken `zaman.nonce.imza` (HMAC) üretilir; en az 3 sn önce, en çok 2 saat önce üretilmiş olmalı. **Her token yalnızca bir mesajda kullanılabilir**: mesajla birlikte token'ın SHA-256 özeti benzersiz indeksle saklanır, aynı token ikinci kez gelirse reddedilir (yeniden oynatma/replay engeli). Başarılı gönderimden sonra sunucu forma yeni bir token verir (`fresh`), böylece aynı açık sayfadan ikinci mesaj yazılabilir.
4. **Cloudflare Turnstile**: `TURNSTILE_SITE_KEY` **ve** `TURNSTILE_SECRET_KEY` ikisi de ayarlıysa açılır (sayfadaki widget ile sunucu kontrolü aynı yardımcıdan karar verir); hata, zaman aşımı veya eksik token = reddedilir (fail-closed).
5. **Hız sınırı**: ziyaretçi başına 5 mesaj/saat, toplam 60 mesaj/saat (saklanan satırlardan sayılır). Kontrol ve kayıt **tek transaction içinde, global advisory lock altında** yapılır; yani eşzamanlı istek yığını sınırı aşamaz (gerçek sunucuda 12 paralel istekten tam 5'i kabul edildi).
6. Mesaj **veritabanına kaydedilir**, sonra (ayarlıysa) e-posta bildirimi gönderilir; bildirim hatası ziyaretçiye hata olarak yansımaz ama sunucu günlüğüne (kişisel veri olmadan) yazılır. Veritabanı hatasında ziyaretçi yazdıklarını kaybetmez (form durumu döner).

**Ziyaretçi adresi güven modeli:** `x-forwarded-for` ziyaretçi tarafından yazılabildiği için yalnızca **bizim güvendiğimiz proxy'nin eklediği** sağdaki giriş kullanılır (`TRUSTED_PROXY_HOPS`; Vercel'de otomatik 1, başka yerde varsayılan 0 = hiçbir başlığa güvenme). Güvenilir adres yoksa ziyaretçi başı sınır uygulanmaz (herkesi tek kovaya doldurmak yerine), yalnızca toplam sınır geçerlidir. Kendi sunucunda proxy arkasındaysan `TRUSTED_PROXY_HOPS` ayarla. Yerelde (Vercel dışı) ziyaretçi başı sınır bu yüzden kapalıdır.

**Saklanan veri:** ad, e-posta, mesaj, durum, `formTokenHash` (token özeti), `ipHash` (HMAC ile tuzlanmış, kısaltılmış özet; ham IP hiçbir yerde tutulmaz). `ipHash` yalnızca hız sınırı için gerekir ve **1 saat sonra silinir** (her yeni mesajda eskiler temizlenir); böylece ziyaretçiyi uzun süre izleme imkânı kalmaz. Mesajların kendisi için saklama süresi: şimdilik elle silinir (admin → Messages → Delete); otomatik temizlik (örn. 12 ay sonra) M9'da zamanlanmış görevle. Formda kısa bir gizlilik notu vardır.

**E-posta bildirimi** (`src/features/contact/email.ts`): Resend HTTP API. `EMAIL_PROVIDER_API_KEY`, `CONTACT_TO_EMAIL` ve `EMAIL_FROM` üçü de ayarlıysa açılır; yoksa atlanır (mesajlar yine de kaydedilir). Ziyaretçinin e-postası `reply_to` olur. **Gerçek Resend hesabıyla henüz denenmedi**, istek biçimi testlerle doğrulandı.

**Cloudflare Turnstile:** doğrulama kodu testlidir ama **gerçek hesapla denenmedi**; widget'ın ikinci denemede yenilenmesi gibi ayrıntılar hesap alındığında ayarlanacak.

**Admin → Messages** (`/admin/messages`): durum filtresi (All/New/Read/Archived, sayılarla), mesaj düz metin olarak gösterilir, "Mark as read/new", "Archive", "Delete" (onaylı). Tüm action'lar önce `requireAdmin()`.

## Zamanlanmış bakım (M9, uygulandı)

**`GET /api/cron/daily`**: Vercel Cron her gün 03:00 (UTC) çağırır (`vercel.json`). Admin route'u değildir; `Authorization: Bearer <CRON_SECRET>` ile korunur (Vercel bu başlığı kendisi ekler, karşılaştırma sabit zamanlıdır). `CRON_SECRET` tanımlı değilse her isteği reddeder (503), yanlış/eksik başlıkta 401. GET ile veri değiştirir çünkü Vercel Cron yalnızca GET gönderir; bu yalnızca bearer korumalı olduğu için kabul edilir, çerez kullanan route'larda tekrarlanmaz.

Üç bağımsız adım paralel çalışır; biri başarısız olursa diğerleri yine çalışır ve yanıt 500 olur (Vercel çağrıyı başarısız gösterir). Ayrıntı yalnızca sunucu günlüğüne yazılır.

1. **Mesajlar:** `ContactSubmission` kayıtları 180 günden sonra silinir (durumdan bağımsız). Kişisel veri olduğu için süresiz tutulmaz.
2. **Sahipsiz yüklemeler:** hiçbir kayıtta (`Profile.avatarUrl/cvUrl`, `SiteSettings.ogImageUrl`, `ProjectMedia.url`) geçmeyen ve 24 saatten eski dosyalar silinir; en eskiler önce, çalıştırma başına en çok 50. Karşılaştırma ham metinle değil depolama anahtarıyla yapılır (`?v=2`, farklı host yazımı sorun olmaz). Yalnızca `VERCEL_ENV=production` iken çalışır: Blob deposu ortamlar arasında ortaktır, önizleme ortamının boş veritabanı canlı dosyaları sahipsiz sanırdı. **Yeni bir alan yükleme adresi tutabiliyorsa (v1.1 blog kapağı/Markdown) `referencedUploadUrls` genişletilmelidir.**
3. **GitHub:** profilde kullanıcı adı varsa bağlı projelerin yıldız/dil/son push bilgisi yenilenir ve sonuç `SiteSettings`'e yazılır.

Yanıt yalnızca sayılar içerir: `{ messages, uploads, github }`, her biri `{ ok: true, detail }` veya `{ ok: false }`. Yerelde çalıştırmak için `CRON_SECRET` tanımlayıp `Authorization: Bearer ...` ile çağır; yükleme adımı canlı dışında atlanır.

## Public

| Metot | Yol | Açıklama |
|---|---|---|
| GET | `/api/projects` | Yayınlanmış projeler (teknoloji filtresi, arama opsiyonel) |
| GET | `/api/projects/[slug]` | Proje detayı |
| GET | `/api/articles`, `/api/articles/[slug]` | Yayınlanmış yazılar |
| POST | `/api/contact` | İletişim formu |

Public sayfalar çoğunlukla veriyi doğrudan feature katmanından okur; bu endpoint'ler harici tüketim ve test içindir.

## Admin (oturum zorunlu)

CRUD: `/api/admin/{projects,articles,technologies,experiences,education,tags}`; `PUT /api/admin/profile`; `PUT /api/admin/settings`; `POST /api/admin/media` (güvenli upload); `POST /api/admin/github/sync`; `GET /api/admin/contact-submissions`. Yayınla/yayından kaldır ve featured `PATCH` ile.

## Upload kuralları

MIME ve boyut allow-list, sunucuda içerik doğrulama, rastgele dosya adı, kod çalıştırılabilir yola yazılmaz, `alt` metni zorunlu.
