import type { MetadataRoute } from "next";
import { getDb } from "@/lib/db";
import { getSiteUrl } from "@/lib/site";

// Projects are managed in the admin dashboard, so the list is read when the sitemap is requested.
export const dynamic = "force-dynamic";

const STATIC_PAGES = ["", "/projects", "/about", "/tech-stack", "/contact"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl().origin;
  const entries: MetadataRoute.Sitemap = STATIC_PAGES.map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.7,
  }));

  try {
    // Published projects only; a draft's address must never be advertised.
    const projects = await getDb().project.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });
    for (const project of projects) {
      entries.push({ url: `${base}/projects/${project.slug}`, lastModified: project.updatedAt, changeFrequency: "monthly", priority: 0.6 });
    }
  } catch (error) {
    // Without a database the static pages are still worth listing.
    console.error("sitemap: could not load projects:", error instanceof Error ? error.name : "unknown error");
  }
  return entries;
}
