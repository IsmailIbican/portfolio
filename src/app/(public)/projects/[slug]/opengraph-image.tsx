import { notFound } from "next/navigation";
import { getPublishedProjectBySlug } from "@/features/projects/service";
import { getProfile } from "@/features/profile/service";
import { getDb } from "@/lib/db";
import { OG_SIZE, renderOgCard } from "@/lib/og-image";

export const alt = "Project";
export const size = OG_SIZE;
export const contentType = "image/png";
export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Per-project preview. Only real, published projects get a card: any other address answers a cheap 404, so
 * requesting thousands of made-up slugs cannot make the server draw thousands of images. Drafts are "unknown" too,
 * so a draft's title is never revealed.
 */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug.length > 80 || !SLUG.test(slug)) notFound();

  const db = getDb();
  const [project, profile] = await Promise.all([getPublishedProjectBySlug(db, slug), getProfile(db)]);
  if (!project) notFound();

  return renderOgCard({ eyebrow: profile?.fullName ?? null, title: project.title, subtitle: project.summary });
}
