import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

// Social preview images are rendered outside the page's CSS, so the design tokens (docs/design-system.md, dark theme)
// are repeated here as plain values. Keep them in sync with src/styles/globals.css.
const COLORS = { bg: "#101114", surface: "#191b1f", text: "#f5f5f4", muted: "#a1a1aa", accent: "#a5b4fc" };

interface CardProps {
  eyebrow?: string | null;
  title: string;
  subtitle?: string | null;
}

/** A calm text card: small label, large title, one supporting line. No decoration beyond a single accent rule. */
export function renderOgCard({ eyebrow, title, subtitle }: CardProps) {
  const shortTitle = title.length > 70 ? `${title.slice(0, 67)}...` : title;
  const shortSubtitle = subtitle && subtitle.length > 140 ? `${subtitle.slice(0, 137)}...` : subtitle;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: COLORS.bg,
          color: COLORS.text,
        }}
      >
        <div style={{ width: 72, height: 4, background: COLORS.accent, marginBottom: 40 }} />
        {eyebrow ? <div style={{ fontSize: 30, color: COLORS.muted, marginBottom: 20 }}>{eyebrow}</div> : null}
        <div style={{ fontSize: shortTitle.length > 40 ? 64 : 84, fontWeight: 700, lineHeight: 1.1 }}>{shortTitle}</div>
        {shortSubtitle ? <div style={{ fontSize: 34, color: COLORS.muted, marginTop: 28, lineHeight: 1.35 }}>{shortSubtitle}</div> : null}
      </div>
    ),
    {
      ...OG_SIZE,
      // Rendering a card is CPU work; letting browsers and CDNs keep it for an hour means repeated requests cost nothing.
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" },
    },
  );
}
