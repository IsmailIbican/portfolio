import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getContactMailto, getSocialLinks } from "@/features/profile/links";
import { getProfile } from "@/features/profile/service";
import { getDb } from "@/lib/db";

// Content is edited in the admin dashboard, so these pages read the database per request.
// Caching with on-demand revalidation is added in the performance milestone (M8).
export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile(getDb());
  const name = profile?.fullName ?? "Portfolio";

  return (
    <>
      <SiteHeader name={name} />
      <main id="content" className="mx-auto w-full max-w-(--container-wide) px-6 pb-24">
        {children}
      </main>
      <SiteFooter name={name} links={getSocialLinks(profile)} mailto={getContactMailto(profile)} />
    </>
  );
}
