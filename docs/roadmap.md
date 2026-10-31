# Roadmap

Durum: uygulama planı kullanıcı tarafından onaylandı (2026-10-30). Kararlar: site yalnızca İngilizce, ücretsiz katman hosting, blog v1.1'e ertelendi, tek admin e-posta+parola.

Sınıflar: **MUST** (v1), **SHOULD** (v1.1), **OPTIONAL** (sonraki sürümler).

Her milestone sonunda typecheck, lint, ilgili testler ve gerekirse build çalıştırılır; sonuçlar dürüstçe raporlanır. Başarısız kontrol varken sonraki milestone'a geçilmez.

| # | Milestone | Sınıf | Durum |
|---|---|---|---|
| M0 | Geliştirme altyapısı (kurallar, kontrol listeleri) | MUST | Tamamlandı |
| M1 | İskelet, tooling, design token'ları, tema, layout, `Reveal` | MUST | Tamamlandı (2026-10-30): typecheck, lint, 7 unit test, build yeşil |
| M2 | Prisma şeması, migration, seed | MUST | Tamamlandı (2026-10-30): migration uygulandı, seed idempotent doğrulandı, 7 integration testi, typecheck/lint/build yeşil |
| M3 | Auth + admin kabuğu | MUST | Tamamlandı (2026-10-30): 18 unit + 15 integration test, typecheck/lint/build yeşil, giriş ve oturum iptali gerçek sunucuda uçtan uca doğrulandı; güvenlik incelemesi bulguları (2 Medium) düzeltildi |
| M4 | Profil, deneyim, eğitim, teknoloji admin + Home/About/Tech Stack | MUST | Tamamlandı (2026-10-31): 40 unit + 24 integration test, typecheck/lint/build yeşil; güvenlik ve arayüz incelemesi bulguları düzeltildi. Formların tarayıcıda elle denenmesi kullanıcıda, otomatik E2E M9'da |
| M5 | Proje CRUD, medya upload, Projects ve detay | MUST | Tamamlandı (2026-10-31): 64 unit + 37 integration test, typecheck/lint/build yeşil; yükleme ve sayfalar gerçek sunucuda doğrulandı; güvenlik ve arayüz incelemesi bulguları düzeltildi. Vercel Blob sürücüsü M9'da (hesapla) |
| M6 | GitHub entegrasyonu | MUST | Tamamlandı (2026-10-31): 81 unit + 51 integration test, typecheck/lint/build yeşil; gerçek GitHub API'siyle (herkese açık hesap) doğrulandı; güvenlik incelemesi bulguları düzeltildi. Kendi hesabınla ilk kullanım kullanıcıda (GitHub kullanıcı adını profile gir) |
| M7 | İletişim formu + anti-spam + e-posta | MUST | Tamamlandı (2026-10-31): 108 unit + 63 integration test, typecheck/lint/build yeşil; form gerçek sunucuda saldırı senaryolarıyla denendi (token yeniden oynatma, sahte X-Forwarded-For, eşzamanlı yük, tuzak alanı, enjeksiyon); güvenlik ve frontend incelemeleri düzeltildi. **E-posta (Resend) ve Turnstile gerçek hesapla denenmedi** |
| M8 | SEO, sitemap, OG, performans/a11y geçişi, CSP | MUST | Tamamlandı (2026-10-31): 124 unit + 66 integration test, typecheck/lint/build yeşil; Lighthouse a11y/best-practices/SEO 100 (6 public + 10 admin sayfa), CLS ≤ 0.017, CSP üretimde doğrulandı; güvenlik incelemesi düzeltildi |
| M9 | E2E, CI, deploy hazırlığı | MUST | Büyük ölçüde tamamlandı (2026-10-31): site canlıda (`ismail-ibican.vercel.app`), Blob sürücüsü, günlük Cron (mesaj temizliği, sahipsiz yükleme süpürmesi, GitHub eşitleme), GitHub Actions CI, 26 Playwright E2E testi. 143 unit + 85 integration test, typecheck/lint/build yeşil. Kullanıcı canlıda admin girişini, Blob yüklemesini, iletişim formunu (Turnstile) ve e-posta bildirimini elle doğruladı. `CRON_SECRET` üretimde tanımlı (yetkisiz isteğe 401, canlıda doğrulandı); CI'daki `e2e` işi ilk çalışmada yeşil. **Kalan:** cron'un ilk gerçek çalışması (2026-11-01 03:00 UTC) ve saha performansı. Ayrıntı: `docs/m9-log.md` |
| v1.1 | Blog (CRUD + public), admin 2FA | SHOULD | Ertelendi |
| — | Proje arama, basit analytics, RSS, i18n | OPTIONAL | Sonraya |

## Performans bütçesi (mobil, p75)

LCP ≤ 2.0 s, INP ≤ 200 ms, CLS ≤ 0.05, public sayfa ilk yük JS ≤ **~160 KB** (gzip). Lighthouse performans/a11y ≥ 95 hedeftir, tek başına amaç değildir.

*2026-10-31'de revize:* JS bütçesi ilk planda ~120 KB idi. Ölçüm: React + Next çalışma zamanı tek başına ~107 KB (gzip), bizim kodumuz ~43 KB, toplam ~150 KB. 120 KB bu çerçeveyle ulaşılamaz bir hedefti; 160 KB yeni, ölçülmüş tavan.

**M8 ölçümü (üretim derlemesi, yerel sunucu, örnek içerikle, Chrome mobil emülasyonu):**

| Ölçüt | Sonuç | Bütçe |
|---|---|---|
| Erişilebilirlik (Lighthouse) | **100** — 6 public + 10 admin sayfa | 100 |
| En iyi uygulamalar / SEO | **100 / 100** | ≥ 95 |
| CLS | **≤ 0.017** (tüm sayfalar) | ≤ 0.05 |
| LCP, *gerçek* ağ yavaşlatması (yavaş 4G + 4x işlemci) | **1.8 – 2.1 sn** (sınırda; ara sıra 2.6 sn'ye çıkan gürültü var) | ≤ 2.0 sn |
| LCP, gerçek ağsız, işlemci 4x | 0.2 – 1.0 sn | ≤ 2.0 sn |
| LCP, Lighthouse *simülasyonu* | ~3.0 – 3.4 sn | yanıltıcı: simülasyon yavaş 4G'yi pessimist modelliyor; gerçek yavaşlatma ve gerçek tarayıcı ölçümüyle çelişiyor |
| TBT (4x işlemci) | 220 – 550 ms | bütçe yok; INP için gerçek cihazda izlenecek |

Bunlar **laboratuvar** sonuçları ve yerel veritabanıyla ölçüldü. Canlıda ağ, veritabanı gecikmesi ve gerçek görsellerle değişir; saha verisi (gerçek ziyaretçiler) M9 sonrası izlenmeli.

## Bilinen ertelenenler (inceleme bulgularından)

- **M9'da kapananlar:** mesajların otomatik silinmesi (180 gün), sahipsiz yüklemelerin süpürülmesi, GitHub zamanlanmış eşitleme, Vercel Blob sürücüsü ve host izin listesi, E2E testlerinin `next start` (CSP zorlanmış) üzerinde koşması, otomatik a11y taraması (axe, WCAG 2.2 AA, açık ve koyu tema), `<details>` mesajının durum değişince açık kalması.

- **M8:** CSP; otomatik kontrast ve a11y taraması (axe); etiketli önbellek; Reveal'in ilk boyamada ekranda olan öğelerde fade göstermesi; `--duration-section` ve stagger/offset değerlerinin token/doküman hizalaması.
- **M7:** IP tabanlı rate limit; admin kilidini açma betiği.
- **Gerçek tarayıcı kontrolü gerekenler:** 320-390px header kırılımı, mobil admin gezintisi, `<details>` açık kalma davranışı, form hata sonrası odak, iOS input zoom.
- **M9 (Blob ile birlikte):** Vercel Blob sürücüsü; Blob host'unun `images.remotePatterns`'e eklenmesi; sahipsiz dosya temizliği (profil kaydında değiştirilen CV/foto artık siliniyor, ama formu kaydetmeden bırakılan yüklemeler sahipsiz kalır → periyodik süpürme veya "bağlanmamış yükleme" kaydı); `/uploads` route'u yalnızca `STORAGE_DRIVER=local` iken çalışır.
- **Bilinen sınırlar:** taslak projenin görseli adresi (UUID) bilinirse erişilebilir ve önbellekte bir yıl kalabilir; gizli ekran görüntüsü taslağa bile yüklenmemeli. Görsel sıralama/kapak seçimi yok (ilk yüklenen kapak). PDF'ler indirme olarak sunuluyor (tarayıcıda satır içi açılmaz). Kaydet düğmeleri gönderim sırasında `disabled`.
- **Gerçek tarayıcı kontrolü gerekenler (M5):** kart hover/odak ve azaltılmış hareket (işletim sistemi ayarıyla), gerçek ekran görüntüleriyle kırpma, 320px'te 4 öğeli header, yükleme formunun ekran okuyucu duyuruları.
- **İsteğe bağlı:** silme onayı JS kapalıyken çalışmaz (`window.confirm`); gerekirse `<dialog>` ile değiştirilir.

- **M6'dan ertelenenler:** GitHub çağrıları için kısa süreli önbellek ve gönderim sırasında düğmeleri pasifleştirme (isteğe bağlı); artık herkese açık olmayan bağlı projelerin başlıklarını admin sayfasında listeleme (şimdilik yalnızca sayı gösteriliyor); zamanlanmış otomatik eşitleme (Vercel Cron, M9).

- **M7'den ertelenenler / hesapla yapılacaklar:** Resend hesabı ve alan adı doğrulaması (gönderen adresi için); Turnstile hesabı (widget'ın yeniden çizimi, ikinci denemede sıfırlama ve koyu tema görünümü gerçek tarayıcıda denenmeli); CSP `https://challenges.cloudflare.com` için `script-src` ve `frame-src` izni vermeli (M8); mesajların otomatik silinmesi (M9); Vercel'de `TRUSTED_PROXY_HOPS` ayarının gerekmediğinin (otomatik 1) canlıda doğrulanması; `AUTH_SECRET` üç amaçla kullanılıyor (oturum, form token'ı, IP özeti), sızarsa üçü birden etkilenir, istenirse ayrı bir anahtara bölünebilir.
- **Gerçek tarayıcı kontrolü gerekenler (M7):** 320px'te 5 öğeli header, form odak ve ekran okuyucu duyuruları, başarı panelinin görünürlüğü, tuzak alanının tarayıcı otomatik doldurmasından etkilenmemesi, Messages'ta uzun metinlerin taşmaması.

- **M8'den M9'a devredenler:** gerçek hesapla e-posta/Turnstile denemesi (M7'den); **saha performansı** (gerçek ziyaretçi LCP/INP) canlıdan sonra izlenmeli; Blob adresini `img-src` ve `images.remotePatterns`'e *tam adresle* ekle (joker yok); HSTS yalnızca üretimde gönderiliyor, alan adı bağlanınca platformun da gönderdiğini doğrula; `NEXT_PUBLIC_SITE_URL` canlıda gerçek https adresi olmalı (aksi halde sunucu günlüğüne uyarı yazılır); proje paylaşım görselleri ve sitemap hâlâ her istekte veritabanını sorgular (olmayan adres ucuz 404, gerçek görseller 1 saat önbelleğe alınır); Markdown/blog geldiğinde (v1.1) temizleyici `style` özniteliklerini de silmeli (CSP `style-src-attr 'unsafe-inline'` buna dayanıyor); e2e testleri `next start` (CSP zorlanmış) üzerinde koşturulmalı.
- **Yeni kural (M8):** `src/proxy.ts` yalnızca iyimser yönlendirmedir ve prefetch isteklerini atlar; /admin ve /api/admin altındaki her yeni sayfa, action ve route kendi içinde `requireAdmin()`/`getAdmin()` çağırmalıdır.

## Açık kararlar

- Medya depolama, e-posta, anti-spam ve rate-limit depo sağlayıcıları (M5 öncesi)
- Light tema renkleri (M1)
- Referans sitelerin incelenmesi ve güncel paket sürümlerinin doğrulanması (M1 başı)
- Vercel Hobby cron limiti ve kullanım şartları (M6 öncesi)
