import type { Metadata } from "next";
import { Reveal } from "@/components/portfolio/reveal";
import { CATEGORY_LABELS } from "@/features/technologies/schema";
import { listTechnologiesByCategory } from "@/features/technologies/service";
import { getDb } from "@/lib/db";

export const metadata: Metadata = { title: "Tech Stack" };

export default async function TechStackPage() {
  const groups = await listTechnologiesByCategory(getDb());

  return (
    <div className="max-w-(--container-prose) pt-16 sm:pt-24">
      <h1 className="hero-in text-3xl font-semibold tracking-tight sm:text-4xl">Tech Stack</h1>

      {groups.length === 0 ? <p className="mt-6 text-muted">Nothing here yet.</p> : null}

      <div className="mt-10 space-y-10">
        {groups.map((group, index) => (
          <Reveal key={group.category} immediate={index === 0}>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">{CATEGORY_LABELS[group.category]}</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {group.items.map((item) => (
                <li key={item.id} className="rounded-base border border-border px-3 py-1 font-mono text-sm">
                  {item.name}
                </li>
              ))}
            </ul>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
