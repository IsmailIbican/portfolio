import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  // Layouts do not re-run on every navigation, so each page verifies access itself.
  await requireAdmin();
  const db = getDb();

  const [projects, draftProjects, newMessages] = await Promise.all([
    db.project.count(),
    db.project.count({ where: { status: "DRAFT" } }),
    db.contactSubmission.count({ where: { status: "NEW" } }),
  ]);

  const stats = [
    { label: "Projects", value: projects },
    { label: "Draft projects", value: draftProjects },
    { label: "New messages", value: newMessages },
  ];

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
      <dl className="mt-8 grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-base border border-border bg-surface p-4">
            <dt className="text-sm text-muted">{stat.label}</dt>
            <dd className="mt-1 text-2xl font-semibold">{stat.value}</dd>
          </div>
        ))}
      </dl>
      {projects === 0 ? (
        <p className="mt-8 text-sm text-muted">No projects yet. Start with your profile, experience and technologies from the menu.</p>
      ) : null}
    </div>
  );
}
