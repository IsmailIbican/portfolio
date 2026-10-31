import { getProfile, getSiteSettings } from "@/features/profile/service";
import { getDb } from "@/lib/db";
import { OG_SIZE, renderOgCard } from "@/lib/og-image";

export const alt = "Portfolio";
export const size = OG_SIZE;
export const contentType = "image/png";
export const dynamic = "force-dynamic";

/** Default social preview for every page: the owner's name and headline. */
export default async function Image() {
  let name: string | null = null;
  let headline: string | null = null;
  try {
    const db = getDb();
    const [profile, settings] = await Promise.all([getProfile(db), getSiteSettings(db)]);
    name = profile?.fullName ?? settings?.siteTitle ?? null;
    headline = profile?.headline ?? null;
  } catch {
    // No database: fall through to a neutral card.
  }
  return renderOgCard({ title: name ?? "Portfolio", subtitle: headline });
}
