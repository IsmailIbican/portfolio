import Link from "next/link";
import { listTechnologies } from "@/features/technologies/service";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { ProjectForm } from "../project-form";

export const metadata = { title: "New project" };

export default async function NewProjectPage() {
  await requireAdmin();
  const technologies = await listTechnologies(getDb());

  return (
    <div className="max-w-2xl">
      <Link href="/admin/projects" className="text-sm text-muted underline underline-offset-4 hover:text-text">
        All projects
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">New project</h1>
      <p className="mt-2 text-sm text-muted">You can add screenshots after the project is created.</p>
      <div className="mt-8">
        <ProjectForm technologies={technologies} />
      </div>
    </div>
  );
}
