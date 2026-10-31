# Design System

Bu dosya token'ların **tek kaynağıdır**. Başka dosyalarda hex/süre değeri tekrar edilmez.

Tasarım ilkesi: *Minimalist görünüm, sofistike mühendislik, cilalı etkileşim.* Referanslar (paco.me, brittanychiang.com, leerob.com, rauno.me, antfu.me) ilham içindir; kopyalanmaz. Bu referanslar henüz doğrudan incelenmedi (M1 başında incelenecek); gözlemler inceleme yapıldığında eklenecek, uydurulmayacak.

| Site | Ne için referans |
|---|---|
| https://paco.me/ | Minimalizm, tipografi, boşluk, sade etkileşim |
| https://brittanychiang.com/ | Proje, deneyim ve teknoloji sunumu |
| https://leerob.com/ | Temiz sayfa yapısı, editoryal sunum, net navigasyon |
| https://rauno.me/ | İnce mikro-etkileşimler, görsel cila |
| https://antfu.me/ | GitHub/open-source entegrasyonu, sade teknik içerik |

### Referans gözlemleri (2026-10-30)

**Sınırlama:** Siteler yalnızca metin/markdown olarak çekildi. CSS, renk, font boyutu, boşluk, animasyon ve responsive davranış **gözlemlenemedi**; bunlar hakkında çıkarım yapılmadı. Aşağıdakiler yalnızca içerik yapısıdır. Görsel inceleme için tarayıcı tabanlı bakış (screenshot) gerekir.

| Site | Gözlenen içerik yapısı |
|---|---|
| paco.me | Tek sütun akış: Building, Projects, Writing, Now, Connect. Projeler görselsiz düz liste (ad + tek satır açıklama). Metin ağırlıklı, seyrek |
| brittanychiang.com | Header (ad, rol, slogan), bölümler About / Experience / Projects / Writing. Deneyim: tarih aralığı, "Rol · Şirket", açıklama, teknoloji etiketleri. Proje: başlık, açıklama, teknoloji listesi, ekran görüntüsü. "Skip to content" linki, "View Full Résumé", "Full Project Archive". Metin Inter ile (footer'da belirtilmiş) |
| leerob.com | Ad + kısa bio, "Notes" listesi, "Blogs" listesi (başlık + ay/yıl). Görselsiz, çok sade |
| rauno.me | Ad + tek cümle tanıtım, Craft/Projects/Notes kutucukları, kısa manifesto satırları, "Email" kopyalama kontrolü |
| antfu.me | Üstte metin navigasyonu (Blog, Projects, Talks, Sponsors) + ikonlu linkler, bio'da proje listesi (GitHub linkli), "Find me on", sponsor bölümü |

**Tasarıma çıkan ilkeler (içerik yapısından):** tek sütun, metin öncelikli hiyerarşi; projeler kısa liste/kart (başlık + tek satır + teknoloji); deneyim zaman sıralı listede; "skip to content" erişilebilirlik detayı; tam proje arşivi/CV için ayrı link. Görsel kararlar (font boyutu, renk, boşluk, motion) bu dosyadaki token'lardan gelir, referanslardan kopyalanmaz.

Kaçınılacaklar: 3D sahneler, dönen küre, aşırı parçacık, cyberpunk/neon, ağır glassmorphism, büyük parlayan gradient, oyun benzeri arayüz, aşırı parallax, scroll-jacking, animasyonlu özel imleç, gereksiz dekoratif öğe.

Hedef kitle: teknik recruiter'lar, mühendislik yöneticileri, yazılım şirketleri, potansiyel müşteriler.

## Renk (semantic token'lar)

| Token | Dark | Light |
|---|---|---|
| `--bg` | `#101114` | `#FAFAF9` |
| `--surface` | `#191B1F` | `#FFFFFF` |
| `--text` | `#F5F5F4` | `#18181B` |
| `--text-muted` | `#A1A1AA` | `#52525B` |
| `--accent` | `#A5B4FC` | `#4F46E5` |
| `--border` | `#2A2D33` | `#E4E4E7` |
| `--border-strong` | `#3A3E46` | `#D4D4D8` |
| `--danger` | `#F87171` | `#B91C1C` |

`--danger` yalnızca hata/yıkıcı eylem içindir; hesaplanan kontrast ≥ 6:1 (her iki temada, `--bg` ve `--surface` üzerinde). Bileşenlerde `text-danger` / `border-danger` kullanılır; ham Tailwind kırmızıları kullanılmaz.

Light tema ve border değerleri M1'de önerildi (dark ana renkler kullanıcı onaylıdır). Kontrast hesapla tahmini AA üzerinde; bir araçla doğrulanması M8'de yapılacak. Uygulama: `src/styles/globals.css` (token'ları burayla senkron tut).

Accent az kullanılır (link, focus, küçük vurgu). Gradient, neon, ağır glassmorphism yok. Metin kontrastı WCAG 2.2 AA.

## Tipografi

- Ana: Inter veya Geist. Kod: JetBrains Mono. Fontlar `next/font` ile self-host.
- Ölçek, satır yüksekliği ve ağırlıklar M1'de token olarak tanımlanacak.

## Spacing, layout

- 4px tabanlı spacing ölçeği; cömert boşluk, tutarlı hizalama.
- Tek okuma sütunu (içerik container'ı dar), proje grid'i için daha geniş container.
- Breakpoint'ler ve container genişlikleri M1'de tanımlanacak.
- Border radius küçük ve tutarlı; ince border, gölge minimum.

## Motion

| Durum | Süre |
|---|---|
| Hover | 150–200ms |
| Kart reveal | 300–450ms |
| Bölüm girişi | 350–500ms |
| Hero girişi | 450–650ms |

- Yalnızca `transform` ve `opacity` animasyonlanır.
- Proje kartı hover: 2–4px yukarı, border rengi geçişi.
- `prefers-reduced-motion` her zaman saygı görür.
- Scroll-jacking, aşırı parallax, özel imleç, parçacık, 3D yok.
- Sayfa geçişleri navigasyonu geciktirmez.

## Bileşen varyantları

Button (primary, secondary, ghost), Card (default, interactive), focus ring (accent, 2px offset). Detaylar M1'de.

## Temalar

Dark varsayılan, light eksiksiz desteklenir; sistem tercihi + kullanıcı seçimi, flash olmadan.
