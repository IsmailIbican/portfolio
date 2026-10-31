# Mimari

Durum: taslak. Stack kararı için bkz. [ADR-0001](decisions/0001-tech-stack.md).

## Katmanlar

```
Route/Page (src/app)  →  Feature (src/features/<alan>)  →  lib (src/lib: db, auth, validation, github)  →  Prisma/PostgreSQL
```

- `src/app/(public)`: herkese açık sayfalar, mümkün olduğunca Server Component.
- `src/app/(admin)`: kimlik doğrulama gerektirir; her sayfa ve her mutation sunucuda yetkiyi yeniden doğrular.
- `src/app/api`: Route Handlers (harici tüketim, webhook, upload, cron).
- `src/features/{projects,blog,contact,github}`: iş mantığı, Zod şemaları, veri erişimi; UI'dan bağımsız.
- `src/components/{ui,layout,portfolio}`: ui = primitifler, layout = shell/nav, portfolio = alan bileşenleri.
- İş mantığı component ve route içine gömülmez; feature katmanından çağrılır.

## Kimlik doğrulama ve yetkilendirme (M3)

- Auth.js v5 (`next-auth@5.0.0-beta.32`), Credentials provider, JWT oturum (8 saat), `src/lib/auth.ts`. Auth endpoint'i: `/api/auth/[...nextauth]`.
- Giriş mantığı `src/features/auth/login.ts` (`authenticate`): Zod doğrulama, argon2id kontrol, hesap/parola/kilit ayrımı istemciye sızdırılmaz (tek genel hata), kullanıcı yoksa veya kilitliyse sahte hash ile süre eşitlenir.
- **Kilitleme:** 5 ardışık hata, 15 dk kilit (DB'de). Deneme hakkı parola doğrulanmadan **önce** tek bir koşullu UPDATE ile atomik ayrılır; paralel isteklerle limit aşılamaz (integration testi: 25 paralel istek, en fazla 5 deneme). Bilinen risk: saldırgan admin'i geçici olarak kilitleyebilir; IP tabanlı rate limit M7'de eklenecek, ondan sonra hesap kilidi yalnızca dağıtık saldırılarda devreye girer. Kilit kurtarma için `lockedUntil` temizleme betiği M7'de eklenecek.
- **Katmanlar:** `src/proxy.ts` yalnızca iyimser çerez kontrolü yapar (Next 16'da `middleware` adı `proxy`). Asıl yetki `requireAdmin()` (`src/lib/session.ts`): oturumu DB ile doğrular (kullanıcı var, rolü ADMIN, `sessionVersion` eşleşiyor, oturum 8 saati aşmamış; mantık `features/auth/session-check.ts`). **Kural:** her korumalı sayfa, server action ve route handler ilk iş `requireAdmin()` çağırır; layout kontrolü server action'ları korumaz.
- **Oturum iptali:** `AdminUser.sessionVersion` JWT'ye yazılır. Çıkış (`logoutAction`) ve ileride parola değişikliği bunu artırır; çalınmış/kopyalanmış çerez geçersiz olur. Oturum ömrü 8 saat mutlaktır (giriş zamanı token'da).
- Admin: `src/app/(admin)/admin/login` herkese açık; `(protected)` grubu `requireAdmin()` ile korunur. Admin sayfaları `noindex` ve `Cache-Control: no-store`.
- Güvenlik header'ları `next.config.ts`'te; CSP nonce gerektirdiği için M8'de eklenecek.

## İçerik ve görünüm ayrımı

Profil, proje, deneyim, blog, yetenek içeriği veritabanında tutulur ve admin panelinden yönetilir. Kaynak kodda kişisel içerik bulunmaz; geliştirme sırasındaki sahte veriler açıkça `MOCK` olarak işaretlenir ve gerçek persistence geldiğinde kaldırılır.

## GitHub entegrasyonu (taslak)

- Sunucu tarafında public repo verisi çekilir (açıklama, dil, yıldız, son güncelleme).
- Sonuçlar veritabanına/cache'e yazılır; sayfa isteği GitHub'a doğrudan gitmez. Yenileme: zamanlanmış veya admin'den manuel.
- Rate-limit: ETag/conditional request, hata durumunda son başarılı veriyi sunma.
- Token yalnızca sunucuda, yalnızca public veri okuma kapsamıyla.
- Repo seçimi, sıralama, featured ve özel açıklama admin'den; GitHub'sız manuel projeler desteklenir.

## Public sayfa planı

Site dili yalnızca İngilizce (kullanıcı kararı). Tüm içerik veritabanından gelir; aşağıdakiler yalnızca bölüm yapısıdır. Blog v1.1'e ertelendi; blog bölümleri o zaman eklenir.

- **Home:** sade navigasyon, kısa profesyonel tanıtım ve mühendislik cümlesi, featured projeler (3 adet: başlık, 1 satır özet, teknoloji etiketleri), temel yetenekler, seçili deneyim özeti (liste), iletişim CTA. "Recent articles" blog gelince eklenir.
- **About:** biyografi, eğitim, iş deneyimi, kariyer zaman çizelgesi, mühendislik ilgi alanları, CV indirme.
- **Projects:** featured projeler, tüm projeler, teknoloji/kategori filtresi, GitHub repo ve canlı demo linkleri, ekran görüntüleri. Arama OPTIONAL.
- **Project details:** genel bakış, problem ve çözüm, teknik mimari, teknolojiler, uygulama detayları, zorluklar, sonuçlar, ekran görüntüleri, GitHub ve demo linkleri, ilgili projeler. Alanlar opsiyoneldir; boş alan gösterilmez.
- **Tech stack:** diller, frontend, backend, veritabanları, DevOps, araçlar (Technology kayıtlarından kategoriye göre).
- **Contact:** profesyonel iletişim bilgisi, çalışan form (doğrulama + anti-spam), sosyal hesaplar.
- **Blog (v1.1):** makaleler, kategori/etiket, detay sayfası, kod blokları ve syntax highlighting, SEO.
- Navigasyon: ince alt çizgi geçişi, sade aktif sayfa göstergesi, pürüzsüz mobil menü, tema değiştirici.

## Admin dashboard planı

Kullanılabilirlik görsel efektten önce gelir; yalnızca kimliği doğrulanmış admin erişir.

- **Yerleşim:** sol sidebar (Overview, Projects, Experience, Education, Technologies, Media, Messages, Profile, Settings, Logout).
- **Dashboard overview:** içerik sayıları, son mesajlar, son GitHub sync durumu.
- **Projects:** tablo (durum, featured, sıra), proje editörü, publish/unpublish, featured kontrolü, sıralama; GitHub'dan repo seçme ve elle proje ekleme.
- **Media library:** yükleme, `alt` zorunlu, silme onayı.
- **Experience / Education / Technologies / Profile / Settings:** form tabanlı yönetim; CV dosyası yükleme.
- **Messages:** iletişim formu kayıtları, okundu/arşiv.
- **Blog editörü:** v1.1.
- **Ortak davranış:** sunucu tarafı doğrulama, silme ve geri alınamaz işlemlerde onay penceresi, loading/empty/error durumları, güvenli logout, reusable UI primitifleri (shadcn/ui yalnızca admin için).
- Basit analytics OPTIONAL; gerekçelendirilirse eklenir.

## Uygulanan durum (M4)

- **Admin:** `/admin/profile`, `/admin/experience`, `/admin/education`, `/admin/technologies`. Liste + açılır (`<details>`) düzenleme formları; silmede onay penceresi. Form altyapısı: `src/components/admin/form.tsx` (`ActionForm` + alan bileşenleri, hata/aria bağlantısı, yazılan değeri koruma).
- **Public:** `/` (hero, key skills, seçili deneyim), `/about` (bio, deneyim, eğitim, CV/sosyal linkler), `/tech-stack` (kategoriye göre). Boş içerikte nötr "Coming soon / Nothing here yet" durumu gösterilir; MOCK içerik yok. Site başlığı/açıklaması `SiteSettings`'ten (`generateMetadata`, DB yoksa varsayılana düşer).
- **Katmanlar:** `features/<alan>/{schema,service}.ts` (Zod + Prisma, db parametreli, integration testli); action'lar ince sarmalayıcı; sayfalar `service` fonksiyonlarını çağırır.
- **Önbellek:** Public sayfalar şimdilik `force-dynamic` (her istekte DB). Performans milestone'u (M8) etiketli önbellek + `revalidatePublic()` ile değiştirecek; `revalidatePublic()` mutation'larda zaten çağrılıyor.
- **Bilinen eksik:** Deneyime teknoloji etiketi bağlama (şemada yok) ve dosya yükleme (CV/foto için şimdilik link) sonraya bırakıldı.

## Uygulanan durum (M5)

- **Admin:** `/admin/projects` (liste), `/admin/projects/new`, `/admin/projects/[id]` (form + teknoloji seçimi + görsel yönetimi + silme). Profil sayfasında CV ve foto için yükleme alanı.
- **Public:** `/projects` (öne çıkanlar, tüm projeler, `?tech=` filtresi: yalnızca yayınlanmış projelerde kullanılan teknolojiler listelenir), `/projects/[slug]` (bağlantılar, görseller, dolu bölümler, ilgili projeler = ortak teknoloji sayısına göre). Ana sayfada "Featured projects". Taslaklar hiçbir public sorguda yer almaz, doğrudan adrese gidilirse 404.
- **Kart:** tüm kart tek bağlantı (başlıktaki `::after`), hover'da 2px yükselme ve border geçişi, `prefers-reduced-motion`'da hareket yok.
- **Bilinen sınırlar:** görsel sıralama şimdilik yükleme sırası (ilk görsel kapak); sürükle-bırak yok. Taslak bir projenin yüklenmiş görsel adresi tahmin edilemez (UUID) ama bilinirse erişilebilir; Blob'da da aynıdır.

## Uygulanan durum (M6)

- `src/features/github/{client,service}.ts`, admin sayfası `/admin/github`, public gösterim `components/portfolio/github-meta.tsx`. Şema değişmedi (GitHub alanları M2'de hazırdı).
- Gerçek GitHub API'si herkese açık `octocat` hesabıyla elle doğrulandı (liste, tek repo, olmayan kullanıcı/repo); testler sahte `fetch` ile hız sınırı, 404, sunucu hatası, bozuk yanıt ve sayfalamayı kapsar.
- Bilinen sınırlar: zamanlanmış eşitleme yok (M9); iki ayrı sorgu sayfası arasında ETag/koşullu istek kullanılmıyor (her yüklemede 1-3 istek); en çok 300 repo listelenir.

## Uygulanan durum (M8): SEO, güvenlik başlıkları, performans

**CSP** (`src/lib/csp.ts`, uygulama `src/proxy.ts`): her istekte yeni bir nonce ile sıkı politika. Betikler yalnızca nonce'u taşıyorsa (veya onun yüklediği betikse, `strict-dynamic`) çalışır; `unsafe-inline`/`unsafe-eval` betiklerde yok. `style-src` nonce'lu; yalnızca `style` *özellikleri* için `'unsafe-inline'` (`next/image` konumlandırmayı böyle yapar, betik çalıştıramaz). `frame-src` ve `connect-src` yalnızca Cloudflare Turnstile'a açık; `frame-ancestors 'none'`, `object-src 'none'`, `form-action 'self'`. https üzerinde `upgrade-insecure-requests`. **Geliştirmede yalnızca `Content-Security-Policy-Report-Only`** gönderilir (dev sunucusu nonce'suz stil enjekte eder), üretimde zorlanır. Üretimde Lighthouse 6 public + 10 admin sayfada CSP konsol hatası görmedi, sayfadaki 25 betiğin 25'i nonce taşıdı. Bedel: nonce her istekte değiştiği için sayfa HTML'i paylaşımlı önbelleğe/CDN'e konamaz (zaten veritabanından dinamik üretiliyor).

**Denenip reddedilenler:** `experimental.inlineCss` (satır içi `<style>` nonce taşımıyor, CSP engelleyince sayfa stilsiz kalıyor; yanıltıcı biçimde hızlı skor veriyordu); `geist` paketi (yedek yazı tipi ölçüleri uymadığı için ilk ziyarette düzen kayıyordu, yerine Google Fonts'tan Geist: otomatik ölçü uyumlu yedek).

**SEO:** `metadataBase` = `NEXT_PUBLIC_SITE_URL`; her sayfada canonical, Open Graph ve Twitter kartı; proje sayfalarında kendi başlık/özet/görseli (sayfa düzeyindeki `openGraph`/`twitter` kökü *ezer*, bu yüzden site adı ve kart türü yeniden belirtilir). `robots.txt` (`/admin`, `/api/` kapalı), `sitemap.xml` (yalnızca yayınlanmış projeler, taslak asla), `opengraph-image`/`twitter-image` (ad + unvan kartı) ve proje başına paylaşım görseli (taslak başlığı sızmaz). `htmlLimitedBots: /.*/`: başlık ve meta etiketleri herkese ilk yanıtın `<head>`'inde gider (varsayılan akış, JS çalıştırmayan istemcilerde etiketleri sayfa sonuna koyuyordu). Favicon: `app/icon.svg`.

**Performans:** ilk kart görseli `loading="eager"` + `fetchPriority="high"`; ekranın üstündeki bölümler `Reveal immediate` (JS gelmeden görünür); filtre düğmeleri telefonda tek satırda kaydırılır (yazı tipi yüklenince satır sayısı değişip sayfayı kaydırıyordu: CLS 0.149 → 0.007). Ölçümler `docs/roadmap.md`'de.

## Kullanıcıdan gelecek içerik

Aşağıdakiler asla uydurulmaz; admin panelinden veya kullanıcıdan alınır: ad, GitHub kullanıcı adı, biyografi, deneyim, eğitim, projeler, yetenekler, CV, sosyal linkler, domain. Geliştirme sırasında yalnızca `MOCK` etiketli geçici veri kullanılabilir.

## Açık konular

Medya depolama sağlayıcısı, e-posta sağlayıcısı, anti-spam sağlayıcısı, rate-limit deposu seçilmedi (kullanıcıdan bilgi/hesap gerekir).
