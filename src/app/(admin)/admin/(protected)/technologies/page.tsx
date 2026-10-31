import { DeleteForm } from "@/components/admin/delete-form";
import { CATEGORY_LABELS } from "@/features/technologies/schema";
import { listTechnologies } from "@/features/technologies/service";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { deleteTechnologyAction } from "./actions";
import { TechnologyForm } from "./technology-form";

export const metadata = { title: "Technologies" };

export default async function AdminTechnologiesPage() {
  await requireAdmin();
  const items = await listTechnologies(getDb());

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Technologies</h1>

      <details className="mt-8 rounded-base border border-border bg-surface p-4">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">Add technology</summary>
        <div className="mt-5">
          <TechnologyForm />
        </div>
      </details>

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No technologies yet. Add your first one above.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <details className="rounded-base border border-border p-4">
                <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-sm font-medium">{item.name}</span>
                  <span className="text-xs text-muted">{CATEGORY_LABELS[item.category]}</span>
                  {item.isKeySkill ? <span className="rounded-base border border-border px-2 py-0.5 text-xs text-muted">Key skill</span> : null}
                </summary>
                <div className="mt-5 space-y-5">
                  <TechnologyForm technology={item} />
                  <DeleteForm
                    action={deleteTechnologyAction}
                    id={item.id}
                    label={`Delete ${item.name}`}
                    confirmMessage={`Delete "${item.name}"? It will also be removed from any project that uses it.`}
                  />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
