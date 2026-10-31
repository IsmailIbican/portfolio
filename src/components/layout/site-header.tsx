import Link from "next/link";
import { SiteNav } from "./site-nav";
import { ThemeToggle } from "./theme-toggle";

interface SiteHeaderProps {
  /** Owner's name from the profile; falls back to a neutral label until it is filled in. */
  name: string;
}

export function SiteHeader({ name }: SiteHeaderProps) {
  return (
    <header className="mx-auto flex w-full max-w-(--container-wide) flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-6">
      <Link href="/" className="text-sm font-medium tracking-tight text-text">
        {name}
      </Link>
      <div className="flex flex-wrap items-center gap-x-4">
        <SiteNav />
        <ThemeToggle />
      </div>
    </header>
  );
}
