import { DeleteForm } from "@/components/admin/delete-form";
import { StatusBadge } from "@/components/admin/status-badge";
import { listEducation } from "@/features/education/service";
import { formatRange } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { deleteEducationAction } from "./actions";
import { EducationForm } from "./education-form";

export const metadata = { title: "Education" };

export default async function AdminEducationPage() {
  await requireAdmin();
  const items = await listEducation(getDb());

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Education</h1>

      <details className="mt-8 rounded-base border border-border bg-surface p-4">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">Add education</summary>
        <div className="mt-5">
          <EducationForm />
        </div>
      </details>

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No education yet. Add your first entry above.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <details className="rounded-base border border-border p-4">
                <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-sm font-medium">{item.degree} · {item.institution}</span>
                  <span className="text-xs text-muted">{formatRange(item.startDate, item.endDate)}</span>
                  <StatusBadge status={item.status} />
                </summary>
                <div className="mt-5 space-y-5">
                  <EducationForm education={item} />
                  <DeleteForm action={deleteEducationAction} id={item.id} label={`Delete ${item.degree} at ${item.institution}`} confirmMessage={`Delete "${item.degree} · ${item.institution}"? This cannot be undone.`} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
