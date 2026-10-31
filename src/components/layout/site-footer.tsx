import type { SocialLink } from "@/features/profile/links";

interface SiteFooterProps {
  name: string;
  links: SocialLink[];
  /** Ready-made mailto: URL (validated by getContactMailto), or null. */
  mailto: string | null;
}

const linkClass = "inline-flex min-h-11 items-center transition-colors duration-(--duration-hover) hover:text-text";

export function SiteFooter({ name, links, mailto }: SiteFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="mx-auto w-full max-w-(--container-wide) border-t border-border px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-muted">
        <p>
          © {year} {name}
        </p>
        <ul className="flex flex-wrap gap-x-5">
          {mailto ? (
            <li>
              <a href={mailto} className={linkClass}>
                Email
              </a>
            </li>
          ) : null}
          {links.map((link) => (
            <li key={link.label}>
              <a href={link.href} rel="noopener noreferrer" target="_blank" className={linkClass}>
                {link.label}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
