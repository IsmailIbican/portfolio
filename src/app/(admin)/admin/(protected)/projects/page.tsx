import Link from "next/link";
import { StatusBadge } from "@/components/admin/status-badge";
import { ButtonLink } from "@/components/ui/button-link";
import { listProjects } from "@/features/projects/service";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Projects" };

export default async function AdminProjectsPage() {
  await requireAdmin();
  const projects = await listProjects(getDb());

  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <ButtonLink href="/admin/projects/new">New project</ButtonLink>
      </div>

      {projects.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No projects yet. Create your first one.</p>
      ) : (
        <ul className="mt-8 divide-y divide-border rounded-base border border-border">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/admin/projects/${project.id}`}
                className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors duration-(--duration-hover) hover:bg-surface"
              >
                <span className="text-sm font-medium">{project.title}</span>
                <StatusBadge status={project.status} />
                {project.featured ? <span className="rounded-base border border-border px-2 py-0.5 text-xs text-muted">Featured</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
