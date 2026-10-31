import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteForm } from "@/components/admin/delete-form";
import { getProject } from "@/features/projects/service";
import { listTechnologies } from "@/features/technologies/service";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { deleteProjectAction, deleteProjectMediaAction } from "../actions";
import { MediaManager } from "../media-manager";
import { ProjectForm } from "../project-form";

export const metadata = { title: "Edit project" };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const db = getDb();
  const [project, technologies] = await Promise.all([getProject(db, id), listTechnologies(db)]);
  if (!project) notFound();

  const { media, technologies: links, ...fields } = project;

  return (
    <div className="max-w-2xl">
      <Link href="/admin/projects" className="text-sm text-muted underline underline-offset-4 hover:text-text">
        All projects
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{project.title}</h1>
      {project.status === "PUBLISHED" ? (
        <p className="mt-2 text-sm">
          <Link href={`/projects/${project.slug}`} className="inline-flex min-h-11 items-center text-muted underline underline-offset-4 hover:text-text">
            View on the site
          </Link>
        </p>
      ) : (
        <p className="mt-3 rounded-base border border-border bg-surface p-3 text-sm" role="note">
          <span className="font-medium">Draft.</span> This project is not visible on the site. Set Visibility to Published and save to show it.
        </p>
      )}

      <div className="mt-8">
        <ProjectForm project={fields} technologies={technologies} selectedTechnologyIds={links.map((link) => link.technologyId)} />
      </div>

      <section className="mt-12" aria-labelledby="images-heading">
        <h2 id="images-heading" className="text-lg font-semibold">
          Images
        </h2>
        <div className="mt-4">
          <MediaManager
            projectId={project.id}
            media={media.map((item) => ({ id: item.id, url: item.url, alt: item.alt }))}
            deleteAction={deleteProjectMediaAction}
          />
        </div>
      </section>

      <section className="mt-12 border-t border-border pt-6" aria-labelledby="danger-heading">
        <h2 id="danger-heading" className="text-lg font-semibold">
          Delete project
        </h2>
        <p className="mt-1 text-sm text-muted">Removes the project and its images permanently.</p>
        <div className="mt-3">
          <DeleteForm action={deleteProjectAction} id={project.id} label={`Delete project ${project.title}`} confirmMessage={`Delete "${project.title}" and all its images? This cannot be undone.`} />
        </div>
      </section>
    </div>
  );
}
