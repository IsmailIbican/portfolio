import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import { headers } from "next/headers";
import { getSiteSettings } from "@/features/profile/service";
import { getDb } from "@/lib/db";
import { getSiteUrl } from "@/lib/site";
import { themeInitScript } from "@/lib/theme";
import "@/styles/globals.css";

// Geist comes from Google Fonts (downloaded at build time and served from this site), not from the `geist` package:
// next/font then builds a fallback font with the same proportions, so text barely moves when the real font arrives.
// With the package's version the filter buttons on /projects re-wrapped on every first visit (measured CLS 0.149).
const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  // Preloaded on purpose: it styles the technology tags on cards, and when it arrived late the tags changed size and
  // pushed the whole project grid down (measured CLS 0.149 on /projects with preload off, versus ~0 with it on).
});

export async function generateMetadata(): Promise<Metadata> {
  let title: string | null = null;
  let description: string | null = null;
  try {
    const settings = await getSiteSettings(getDb());
    title = settings?.siteTitle ?? null;
    description = settings?.siteDescription ?? null;
  } catch (error) {
    // No database at build time is expected; at runtime it is worth knowing about. Either way fall back to defaults.
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      // Name only: database errors can carry host and database details.
      console.error("generateMetadata: could not load site settings:", error instanceof Error ? error.name : "unknown error");
    }
  }

  const siteName = title ?? "Portfolio";
  return {
    metadataBase: getSiteUrl(),
    title: { default: siteName, template: `%s | ${siteName}` },
    description: description ?? undefined,
    // "./" resolves to the address of whichever page is being rendered.
    alternates: { canonical: "./" },
    openGraph: { type: "website", siteName, title: siteName, description: description ?? undefined, locale: "en_US" },
    twitter: { card: "summary_large_image", title: siteName, description: description ?? undefined },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#101114" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The per-request nonce put there by src/proxy.ts; the strict CSP only lets scripts that carry it run.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${geistSans.variable} ${jetbrainsMono.variable}`}>
      <head>
        {/* Sets the theme before first paint, so there is no flash of the wrong theme. A plain <script> on purpose:
            next/script wraps it in a second script whose nonce React then reports as a hydration mismatch.
            suppressHydrationWarning: after a script has run, browsers hide its nonce value from the page (nonce=""),
            so React sees a harmless difference from what the server sent. It affects only this element. */}
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-base focus:bg-surface focus:px-3 focus:py-2 focus:text-sm"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
