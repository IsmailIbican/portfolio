import { ActionForm, CheckboxField, SelectField, TextField } from "@/components/forms/form";
import type { Technology } from "@/generated/prisma/client";
import { CATEGORY_LABELS, TECHNOLOGY_CATEGORIES } from "@/features/technologies/schema";
import { createTechnologyAction, updateTechnologyAction } from "./actions";

const CATEGORY_OPTIONS = TECHNOLOGY_CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] }));

export function TechnologyForm({ technology }: { technology?: Technology }) {
  return (
    <ActionForm action={technology ? updateTechnologyAction : createTechnologyAction} submitLabel={technology ? "Save changes" : "Add technology"}>
      {technology ? <input type="hidden" name="id" value={technology.id} /> : null}
      <TextField name="name" label="Name" required defaultValue={technology?.name} />
      <SelectField name="category" label="Category" options={CATEGORY_OPTIONS} defaultValue={technology?.category ?? "LANGUAGE"} />
      <CheckboxField name="isKeySkill" label="Key skill" defaultChecked={technology?.isKeySkill} hint="Shown in the key skills area of the home page. Pick only a few." />
    </ActionForm>
  );
}
