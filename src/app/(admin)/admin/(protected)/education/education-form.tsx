import { ActionForm, SelectField, TextAreaField, TextField } from "@/components/forms/form";
import type { Education } from "@/generated/prisma/client";
import { toMonthInput } from "@/lib/dates";
import { createEducationAction, updateEducationAction } from "./actions";

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft (hidden from the site)" },
  { value: "PUBLISHED", label: "Published (visible on the site)" },
];

export function EducationForm({ education }: { education?: Education }) {
  return (
    <ActionForm action={education ? updateEducationAction : createEducationAction} submitLabel={education ? "Save changes" : "Add education"}>
      {education ? <input type="hidden" name="id" value={education.id} /> : null}
      <TextField name="institution" label="Institution" required defaultValue={education?.institution} />
      <TextField name="degree" label="Degree" required defaultValue={education?.degree} hint="For example BSc, MSc or Certificate." />
      <TextField name="field" label="Field of study" defaultValue={education?.field} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="startDate" type="month" label="Start" required defaultValue={toMonthInput(education?.startDate)} />
        <TextField name="endDate" type="month" label="End" defaultValue={toMonthInput(education?.endDate)} hint="Leave empty if ongoing." />
      </div>
      <TextAreaField name="description" label="Notes" rows={3} defaultValue={education?.description} hint="Optional. Plain text." />
      <SelectField name="status" label="Visibility" options={STATUS_OPTIONS} defaultValue={education?.status ?? "DRAFT"} hint="New entries start as drafts so nothing goes live half-written. Choose Published when ready." />
    </ActionForm>
  );
}
