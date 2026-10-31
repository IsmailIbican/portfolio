import { DeleteForm } from "@/components/admin/delete-form";
import { StatusBadge } from "@/components/admin/status-badge";
import { listExperience } from "@/features/experience/service";
import { getDb } from "@/lib/db";
import { formatRange } from "@/lib/dates";
import { requireAdmin } from "@/lib/session";
import { deleteExperienceAction } from "./actions";
import { ExperienceForm } from "./experience-form";

export const metadata = { title: "Experience" };

export default async function AdminExperiencePage() {
  await requireAdmin();
  const items = await listExperience(getDb());

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Experience</h1>

      <details className="mt-8 rounded-base border border-border bg-surface p-4">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">Add experience</summary>
        <div className="mt-5">
          <ExperienceForm />
        </div>
      </details>

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No experience yet. Add your first entry above.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <details className="rounded-base border border-border p-4">
                <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-sm font-medium">{item.role} · {item.company}</span>
                  <span className="text-xs text-muted">{formatRange(item.startDate, item.endDate)}</span>
                  <StatusBadge status={item.status} />
                </summary>
                <div className="mt-5 space-y-5">
                  <ExperienceForm experience={item} />
                  <DeleteForm action={deleteExperienceAction} id={item.id} label={`Delete ${item.role} at ${item.company}`} confirmMessage={`Delete "${item.role} · ${item.company}"? This cannot be undone.`} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
